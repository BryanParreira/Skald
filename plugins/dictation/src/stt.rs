#[cfg(target_os = "macos")]
pub use self::macos::ActiveSession;

#[cfg(not(target_os = "macos"))]
pub use self::stub::ActiveSession;

#[cfg(target_os = "macos")]
mod macos {
    use bytes::Bytes;
    use futures_util::StreamExt;
    use owhisper_client::hypr_ws_client;
    use owhisper_interface::{ControlMessage, MixedMessage, stream::StreamResponse};
    use tauri::{AppHandle, Manager, Runtime};
    use tokio::sync::oneshot;

    use crate::error::Error;

    // Prefers the Parakeet streaming model the app downloads for meeting
    // transcription, run in-process through the Soniqo bridge, so dictation
    // needs no second model. Falls back to the "am" sidecar when an API key is
    // set, and to the whisper.cpp model otherwise.
    const FALLBACK_WHISPER_MODEL: hypr_whisper_local_model::WhisperModel =
        hypr_whisper_local_model::WhisperModel::QuantizedSmallEn;

    const TARGET_RATE: u32 = 16000;

    type BoxedResponseStream = std::pin::Pin<
        Box<dyn futures_util::Stream<Item = Result<StreamResponse, hypr_ws_client::Error>> + Send>,
    >;

    pub struct ActiveSession {
        stop_tx: oneshot::Sender<()>,
        join: tokio::task::JoinHandle<String>,
    }

    impl ActiveSession {
        pub async fn start<R: Runtime>(app: AppHandle<R>) -> Result<Self, Error> {
            use tauri_plugin_local_stt::{LocalModel, LocalSttPluginExt, SharedState};

            let soniqo_model = hypr_transcribe_soniqo::SoniqoModel::ParakeetStreaming;
            let soniqo_ready = tokio::task::spawn_blocking(move || {
                hypr_transcribe_soniqo::is_model_downloaded(soniqo_model).unwrap_or(false)
            })
            .await
            .unwrap_or(false);

            // The Soniqo bridge runs one live session for the whole app, so
            // starting dictation now would cut off a meeting being transcribed.
            if soniqo_ready && hypr_transcribe_soniqo::is_live_session_active() {
                return Err(Error::Stt(
                    "a recording is already being transcribed live".to_string(),
                ));
            }

            let am_api_key = {
                let state = app.state::<SharedState>();
                let guard = state.lock().await;
                guard.am_api_key.clone().filter(|k| !k.is_empty())
            };

            let am_model = hypr_am::AmModel::ParakeetV2;
            let use_argmax = am_api_key.is_some()
                && app
                    .local_stt()
                    .is_model_downloaded(&LocalModel::Am(am_model.clone()))
                    .await
                    .unwrap_or(false);

            // Mic capture is set up once and fed into whichever backend we pick below.
            let mic =
                hypr_audio_actual::MicInput::new(None).map_err(|e| Error::Audio(e.to_string()))?;
            let chunk_size = hypr_audio_utils::chunk_size_for_stt(TARGET_RATE);
            let resampled = {
                use hypr_resampler::ResampleExtDynamicNew;
                mic.stream()
                    .resampled_chunks(TARGET_RATE, chunk_size)
                    .map_err(|e| Error::Audio(e.to_string()))?
            };

            let (stop_tx, stop_rx) = oneshot::channel::<()>();

            if soniqo_ready {
                let session = tokio::task::spawn_blocking(move || {
                    hypr_transcribe_soniqo::LiveTranscriptionSession::start(soniqo_model)
                })
                .await
                .map_err(|e| Error::Stt(format!("soniqo start task failed: {e}")))?
                .map_err(|e| Error::Stt(e.to_string()))?;

                let join = tokio::spawn(run_soniqo(session, resampled, stop_rx));
                return Ok(Self { stop_tx, join });
            }

            let (audio_tx, audio_rx) =
                tokio::sync::mpsc::channel::<MixedMessage<Bytes, ControlMessage>>(64);
            tokio::spawn(forward_mic_to_channel(resampled, audio_tx, stop_rx));
            let input_stream = tokio_stream::wrappers::ReceiverStream::new(audio_rx);

            let response_stream: BoxedResponseStream = if use_argmax {
                let server_url = app
                    .local_stt()
                    .start_server(LocalModel::Am(am_model.clone()))
                    .await
                    .map_err(|e| Error::Stt(e.to_string()))?;

                let params = owhisper_interface::ListenParams {
                    model: Some(am_model.to_string()),
                    languages: vec![hypr_language::ISO639::En.into()],
                    ..Default::default()
                };

                let client = owhisper_client::ListenClient::builder()
                    .adapter::<owhisper_client::ArgmaxAdapter>()
                    .api_base(server_url)
                    .api_key(am_api_key.expect("checked above"))
                    .params(params)
                    .build_single()
                    .await;

                let (stream, _handle) = client
                    .from_realtime_audio(input_stream)
                    .await
                    .map_err(|e| Error::Stt(e.to_string()))?;
                Box::pin(stream)
            } else {
                let server_url = app
                    .local_stt()
                    .start_server(LocalModel::Whisper(FALLBACK_WHISPER_MODEL))
                    .await
                    .map_err(|e| Error::Stt(e.to_string()))?;

                let client = owhisper_client::ListenClient::builder()
                    .api_base(server_url)
                    .build_single()
                    .await;

                let (stream, _handle) = client
                    .from_realtime_audio(input_stream)
                    .await
                    .map_err(|e| Error::Stt(e.to_string()))?;
                Box::pin(stream)
            };

            let join = tokio::spawn(collect_transcript(response_stream));

            Ok(Self { stop_tx, join })
        }

        pub async fn stop(self) -> Result<String, Error> {
            let _ = self.stop_tx.send(());
            self.join
                .await
                .map_err(|e| Error::Stt(format!("transcription task panicked: {e}")))
        }
    }

    async fn forward_mic_to_channel(
        mut resampled: impl futures_util::Stream<Item = Result<Vec<f32>, hypr_resampler::Error>> + Unpin,
        audio_tx: tokio::sync::mpsc::Sender<MixedMessage<Bytes, ControlMessage>>,
        mut stop_rx: oneshot::Receiver<()>,
    ) {
        loop {
            tokio::select! {
                biased;

                _ = &mut stop_rx => {
                    let _ = audio_tx.send(MixedMessage::Control(ControlMessage::Finalize)).await;
                    break;
                }
                chunk = resampled.next() => {
                    match chunk {
                        Some(Ok(samples)) => {
                            let bytes = hypr_audio_utils::f32_to_i16_bytes(samples.into_iter());
                            if audio_tx.send(MixedMessage::Audio(bytes)).await.is_err() {
                                break;
                            }
                        }
                        _ => break,
                    }
                }
            }
        }
    }

    // After release the resampler may still hold the tail of the last word, so
    // keep reading briefly before finalizing instead of cutting it off.
    const SONIQO_TAIL: std::time::Duration = std::time::Duration::from_millis(250);

    type SoniqoSession = hypr_transcribe_soniqo::LiveTranscriptionSession;

    async fn run_soniqo(
        session: SoniqoSession,
        mut resampled: impl futures_util::Stream<Item = Result<Vec<f32>, hypr_resampler::Error>> + Unpin,
        mut stop_rx: oneshot::Receiver<()>,
    ) -> String {
        let mut session = Some(session);
        let mut transcript = String::new();

        loop {
            tokio::select! {
                biased;

                _ = &mut stop_rx => break,
                chunk = resampled.next() => {
                    let Some(Ok(samples)) = chunk else {
                        break;
                    };
                    let Some(current) = session.take() else {
                        break;
                    };
                    match append_samples(current, samples).await {
                        Ok((next, partials)) => {
                            push_final_texts(&mut transcript, partials);
                            session = Some(next);
                        }
                        Err(error) => {
                            tracing::warn!(%error, "dictation_soniqo_append_failed");
                            break;
                        }
                    }
                }
            }
        }

        let deadline = tokio::time::Instant::now() + SONIQO_TAIL;
        while let Some(current) = session.take() {
            let Ok(Some(Ok(samples))) = tokio::time::timeout_at(deadline, resampled.next()).await
            else {
                session = Some(current);
                break;
            };
            match append_samples(current, samples).await {
                Ok((next, partials)) => {
                    push_final_texts(&mut transcript, partials);
                    session = Some(next);
                }
                Err(error) => tracing::warn!(%error, "dictation_soniqo_tail_append_failed"),
            }
        }

        if let Some(current) = session {
            let finished = tokio::task::spawn_blocking(move || {
                let mut current = current;
                let result = current.finalize(hypr_transcribe_soniqo::TranscriptSource::Microphone);
                let _ = current.stop();
                result
            })
            .await;

            match finished {
                Ok(Ok(partials)) => push_final_texts(&mut transcript, partials),
                Ok(Err(error)) => tracing::warn!(%error, "dictation_soniqo_finalize_failed"),
                Err(error) => tracing::warn!(%error, "dictation_soniqo_finalize_join_failed"),
            }
        }

        transcript
    }

    // The bridge call blocks on Core ML, so it runs off the async runtime. The
    // session moves into the blocking task and back out with the result.
    async fn append_samples(
        session: SoniqoSession,
        samples: Vec<f32>,
    ) -> Result<(SoniqoSession, Vec<hypr_transcribe_soniqo::LivePartial>), String> {
        let (session, result) = tokio::task::spawn_blocking(move || {
            let mut session = session;
            let result = session.append(
                hypr_transcribe_soniqo::TranscriptSource::Microphone,
                &samples,
            );
            (session, result)
        })
        .await
        .map_err(|e| format!("append task failed: {e}"))?;

        result
            .map(|partials| (session, partials))
            .map_err(|e| e.to_string())
    }

    // Non-final partials are hypotheses the model will still revise, so only
    // committed segments become text.
    fn push_final_texts(
        transcript: &mut String,
        partials: Vec<hypr_transcribe_soniqo::LivePartial>,
    ) {
        for partial in partials {
            let text = partial.text.trim();
            if !partial.is_final || text.is_empty() {
                continue;
            }
            if !transcript.is_empty() {
                transcript.push(' ');
            }
            transcript.push_str(text);
        }
    }

    async fn collect_transcript(
        response_stream: impl futures_util::Stream<Item = Result<StreamResponse, hypr_ws_client::Error>>,
    ) -> String {
        futures_util::pin_mut!(response_stream);

        let mut transcript = String::new();
        while let Some(item) = response_stream.next().await {
            let Ok(StreamResponse::TranscriptResponse {
                is_final,
                speech_final,
                channel,
                ..
            }) = item
            else {
                continue;
            };

            if !is_final && !speech_final {
                continue;
            }

            if let Some(alt) = channel.alternatives.first() {
                if !alt.transcript.is_empty() {
                    if !transcript.is_empty() {
                        transcript.push(' ');
                    }
                    transcript.push_str(&alt.transcript);
                }
            }
        }

        transcript
    }

    #[cfg(test)]
    mod tests {
        use owhisper_interface::stream::{Alternatives, Channel, Metadata};

        use super::*;

        fn segment(transcript: &str, is_final: bool, speech_final: bool) -> StreamResponse {
            StreamResponse::TranscriptResponse {
                start: 0.0,
                duration: 1.0,
                is_final,
                speech_final,
                from_finalize: false,
                channel: Channel {
                    alternatives: vec![Alternatives {
                        transcript: transcript.to_string(),
                        words: vec![],
                        confidence: 1.0,
                        languages: vec![],
                    }],
                },
                metadata: Metadata::default(),
                channel_index: vec![0],
            }
        }

        #[tokio::test]
        async fn joins_only_final_segments_with_a_space() {
            let items = vec![
                Ok(segment("hello", false, false)), // interim, dropped
                Ok(segment("hello", true, false)),
                Ok(segment("world", false, true)),
            ];
            let transcript = collect_transcript(futures_util::stream::iter(items)).await;
            assert_eq!(transcript, "hello world");
        }

        #[tokio::test]
        async fn skips_empty_final_transcripts() {
            let items = vec![Ok(segment("", true, false)), Ok(segment("hi", true, false))];
            let transcript = collect_transcript(futures_util::stream::iter(items)).await;
            assert_eq!(transcript, "hi");
        }

        #[tokio::test]
        async fn ignores_non_transcript_and_error_items() {
            let items: Vec<Result<StreamResponse, hypr_ws_client::Error>> = vec![
                Ok(StreamResponse::SpeechStartedResponse {
                    channel: vec![0],
                    timestamp: 0.0,
                }),
                Ok(segment("hi", true, true)),
            ];
            let transcript = collect_transcript(futures_util::stream::iter(items)).await;
            assert_eq!(transcript, "hi");
        }

        fn partial(text: &str, is_final: bool) -> hypr_transcribe_soniqo::LivePartial {
            hypr_transcribe_soniqo::LivePartial {
                source: "microphone".to_string(),
                text: text.to_string(),
                is_final,
            }
        }

        #[test]
        fn soniqo_keeps_only_committed_segments() {
            let mut transcript = String::new();
            push_final_texts(
                &mut transcript,
                vec![
                    partial("hel", false),
                    partial("hello", true),
                    partial("  ", true),
                ],
            );
            push_final_texts(&mut transcript, vec![partial(" world ", true)]);
            assert_eq!(transcript, "hello world");
        }

        #[tokio::test]
        async fn empty_stream_yields_empty_transcript() {
            let items: Vec<Result<StreamResponse, hypr_ws_client::Error>> = vec![];
            let transcript = collect_transcript(futures_util::stream::iter(items)).await;
            assert_eq!(transcript, "");
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod stub {
    use tauri::{AppHandle, Runtime};

    use crate::error::Error;

    pub struct ActiveSession;

    impl ActiveSession {
        pub async fn start<R: Runtime>(_app: AppHandle<R>) -> Result<Self, Error> {
            Err(Error::Unsupported)
        }

        pub async fn stop(self) -> Result<String, Error> {
            Ok(String::new())
        }
    }
}
