use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tauri::{Manager, Runtime, ipc::Channel};
use tauri_specta::Event;

use skald_model_downloader::{DownloadableModel, ModelDownloadManager, ModelDownloaderRuntime};

struct TauriModelRuntime<R: Runtime> {
    app_handle: tauri::AppHandle<R>,
    channels: Arc<std::sync::Mutex<HashMap<String, Channel<i8>>>>,
}

impl<R: Runtime> ModelDownloaderRuntime<crate::SupportedModel> for TauriModelRuntime<R> {
    fn models_base(&self) -> Result<PathBuf, skald_model_downloader::Error> {
        Ok(models_base(&self.app_handle))
    }

    fn emit_progress(
        &self,
        model: &crate::SupportedModel,
        status: skald_model_downloader::DownloadStatus,
    ) {
        use skald_model_downloader::DownloadStatus;

        // Global broadcast — the only way progress reaches listeners that
        // weren't the ones who triggered the download (e.g. the Settings UI
        // observing a background prefetch kicked off from app startup,
        // which never registers a per-call `Channel` below).
        let _ = crate::DownloadProgressPayload {
            model: model.clone(),
            status: status.clone(),
        }
        .emit(&self.app_handle);

        let progress: i8 = match &status {
            DownloadStatus::Downloading(p) => *p as i8,
            DownloadStatus::Completed => 100,
            DownloadStatus::Failed(_) => -1,
        };

        let key = model.download_key();
        let mut guard = self.channels.lock().unwrap();

        let Some(channel) = guard.get(&key) else {
            return;
        };

        let send_result = channel.send(progress);
        let is_terminal = matches!(
            status,
            DownloadStatus::Completed | DownloadStatus::Failed(_)
        );
        if send_result.is_err() || is_terminal {
            guard.remove(&key);
        }
    }
}

pub fn create_model_downloader<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    channels: Arc<std::sync::Mutex<HashMap<String, Channel<i8>>>>,
) -> ModelDownloadManager<crate::SupportedModel> {
    let runtime = Arc::new(TauriModelRuntime {
        app_handle: app_handle.clone(),
        channels,
    });
    ModelDownloadManager::new(runtime)
}

fn models_base<R: Runtime, T: Manager<R>>(manager: &T) -> PathBuf {
    use tauri_plugin_settings::SettingsPluginExt;

    manager
        .settings()
        .global_base()
        .map(|base| base.join("models").into_std_path_buf())
        .unwrap_or_else(|_| dirs::data_dir().unwrap_or_default().join("models"))
}

async fn downloader<R: Runtime>(
    manager: &impl Manager<R>,
) -> ModelDownloadManager<crate::SupportedModel> {
    let state = manager.state::<crate::SharedState>();
    state.lock().await.model_downloader.clone()
}

pub struct LocalLlmExt<'a, R: Runtime, M: Manager<R>> {
    manager: &'a M,
    _runtime: std::marker::PhantomData<fn() -> R>,
}

impl<'a, R: Runtime, M: Manager<R>> LocalLlmExt<'a, R, M> {
    pub fn models_dir(&self) -> PathBuf {
        skald_local_llm_core::llm_models_dir(&models_base(self.manager))
    }

    #[tracing::instrument(skip_all)]
    pub async fn is_model_downloading(&self, model: &crate::SupportedModel) -> bool {
        downloader(self.manager).await.is_downloading(model).await
    }

    #[tracing::instrument(skip_all)]
    pub async fn is_model_downloaded(
        &self,
        model: &crate::SupportedModel,
    ) -> Result<bool, crate::Error> {
        Ok(downloader(self.manager).await.is_downloaded(model).await?)
    }

    #[tracing::instrument(skip_all)]
    pub async fn server_url(&self) -> Result<Option<String>, crate::Error> {
        let state = self.manager.state::<crate::ServerState>();
        let guard = state.lock().await;

        Ok(guard.as_ref().map(|server| server.url().to_string()))
    }

    #[tracing::instrument(skip_all)]
    pub async fn download_model(
        &self,
        model: crate::SupportedModel,
        channel: Channel<i8>,
    ) -> Result<(), crate::Error> {
        let key = model.download_key();

        let (dl, channels) = {
            let state = self.manager.state::<crate::SharedState>();
            let guard = state.lock().await;
            (
                guard.model_downloader.clone(),
                guard.download_channels.clone(),
            )
        };

        dl.cancel_download(&model).await?;

        {
            let mut guard = channels.lock().unwrap();
            if let Some(existing) = guard.insert(key.clone(), channel) {
                let _ = existing.send(-1);
            }
        }

        if let Err(e) = dl.download(&model).await {
            let mut guard = channels.lock().unwrap();
            if let Some(channel) = guard.remove(&key) {
                let _ = channel.send(-1);
            }
            return Err(e.into());
        }

        Ok(())
    }

    // For silent background prefetch (e.g. on app startup) where there's no
    // frontend progress listener to wire a `Channel` to — skips the
    // channel/progress-emission machinery `download_model` needs for the
    // Settings UI's download button.
    #[tracing::instrument(skip_all)]
    pub async fn ensure_model_downloaded(
        &self,
        model: crate::SupportedModel,
    ) -> Result<(), crate::Error> {
        if self.is_model_downloaded(&model).await? {
            return Ok(());
        }

        let dl = {
            let state = self.manager.state::<crate::SharedState>();
            let guard = state.lock().await;
            guard.model_downloader.clone()
        };
        dl.download(&model).await?;
        Ok(())
    }

    #[tracing::instrument(skip_all)]
    pub async fn cancel_download(
        &self,
        model: crate::SupportedModel,
    ) -> Result<bool, crate::Error> {
        Ok(downloader(self.manager)
            .await
            .cancel_download(&model)
            .await?)
    }

    #[tracing::instrument(skip_all)]
    pub async fn delete_model(&self, model: &crate::SupportedModel) -> Result<(), crate::Error> {
        downloader(self.manager).await.delete(model).await?;
        Ok(())
    }

    #[tracing::instrument(skip_all)]
    pub async fn list_downloaded_model(&self) -> Result<Vec<crate::SupportedModel>, crate::Error> {
        Ok(skald_local_llm_core::list_downloaded_models(
            &self.models_dir(),
        )?)
    }

    #[tracing::instrument(skip_all)]
    pub async fn list_custom_models(&self) -> Result<Vec<crate::CustomModelInfo>, crate::Error> {
        Ok(skald_local_llm_core::list_custom_models()?)
    }

    #[tracing::instrument(skip_all)]
    pub async fn start_server(&self, model: crate::SupportedModel) -> Result<String, crate::Error> {
        tracing::info!("start_server called for {model:?}");

        // Held for the whole check-spawn-store sequence, not just the
        // check — otherwise concurrent callers (multiple UI components
        // each independently trying to ensure the server is up) all see
        // no server running, drop the lock to spawn, and each starts its
        // own instance. Separate from `SharedState`'s lock so this doesn't
        // block unrelated download-status queries for the duration.
        let state = self.manager.state::<crate::ServerState>();
        let mut guard = state.lock().await;

        if let Some(server) = guard.as_ref() {
            tracing::info!("start_server: already running at {}", server.url());
            return Ok(server.url().to_string());
        }

        if !self.is_model_downloaded(&model).await? {
            tracing::warn!("start_server: model not downloaded");
            return Err(skald_local_llm_core::Error::ModelNotDownloaded.into());
        }

        let file_path = self.models_dir().join(model.file_name());
        tracing::info!("start_server: model file at {}", file_path.display());

        // llama-server isn't statically linked — it loads its libggml-*/
        // libllama-*.dylib siblings via `@loader_path`, so it ships as a
        // `bundle.resources` directory (see fetch-llama-server.sh) rather
        // than a single-file `externalBin` sidecar, which would drop it
        // alone in Contents/MacOS/ with no dylibs beside it.
        let binary_path = self
            .manager
            .path()
            .resolve(
                "llama-server-bin/llama-server",
                tauri::path::BaseDirectory::Resource,
            )
            .map_err(|e| crate::Error::Other(e.to_string()))?;
        tracing::info!(
            "start_server: resolved binary path {} (exists={})",
            binary_path.display(),
            binary_path.exists()
        );

        use tauri_plugin_shell::ShellExt;
        let command = self.manager.app_handle().shell().command(&binary_path);

        let server = match skald_local_llm_core::LlmServer::start_with_model_path(
            model.display_name().to_string(),
            file_path,
            command,
        )
        .await
        {
            Ok(server) => server,
            Err(e) => {
                tracing::error!("start_server: spawn/readiness failed: {e}");
                return Err(e.into());
            }
        };
        tracing::info!("start_server: ready at {}", server.url());

        let url = server.url().to_string();
        let mut exit_rx = server.exit_receiver();
        *guard = Some(server);

        // If llama-server dies on its own (crash, OOM-killed, Metal error),
        // nothing else notices — `guard` would keep returning this URL as
        // if the server were still alive, and every future `start_server`
        // call would just hand back a dead endpoint forever instead of
        // respawning. Clear the slot so the next call actually restarts it.
        let app_handle = self.manager.app_handle().clone();
        let exited_url = url.clone();
        tauri::async_runtime::spawn(async move {
            if exit_rx.changed().await.is_ok() && *exit_rx.borrow() {
                let state = app_handle.state::<crate::ServerState>();
                let mut guard = state.lock().await;
                // Only clear if the slot still holds *this* instance — it
                // may have already been stopped and replaced by a newer
                // one by the time this exit notification lands.
                if guard.as_ref().is_some_and(|s| s.url() == exited_url) {
                    tracing::warn!("local LLM server exited unexpectedly, clearing cached state");
                    guard.take();
                }
            }
        });

        Ok(url)
    }

    #[tracing::instrument(skip_all)]
    pub async fn stop_server(&self) {
        let server = {
            let state = self.manager.state::<crate::ServerState>();
            let mut guard = state.lock().await;
            guard.take()
        };

        if let Some(server) = server {
            server.stop().await;
        }
    }
}

pub trait LocalLlmPluginExt<R: Runtime> {
    fn local_llm(&self) -> LocalLlmExt<'_, R, Self>
    where
        Self: Manager<R> + Sized;
}

impl<R: Runtime, T: Manager<R>> LocalLlmPluginExt<R> for T {
    fn local_llm(&self) -> LocalLlmExt<'_, R, Self>
    where
        Self: Sized,
    {
        LocalLlmExt {
            manager: self,
            _runtime: std::marker::PhantomData,
        }
    }
}
