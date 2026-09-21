use rmcp::{ErrorData as McpError, model::*};

use crate::state::AppState;

pub(crate) async fn read_url(
    state: &AppState,
    params: notiz_jina::ReadUrlRequest,
) -> Result<CallToolResult, McpError> {
    let text = state
        .jina
        .read_url(params)
        .await
        .map_err(|e: notiz_jina::Error| McpError::internal_error(e.to_string(), None))?;

    Ok(CallToolResult::success(vec![Content::text(text)]))
}
