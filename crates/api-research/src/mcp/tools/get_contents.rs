use rmcp::{ErrorData as McpError, model::*};

use crate::state::AppState;

pub(crate) async fn get_contents(
    state: &AppState,
    params: notiz_exa::GetContentsRequest,
) -> Result<CallToolResult, McpError> {
    let response = state
        .exa
        .get_contents(params)
        .await
        .map_err(|e: notiz_exa::Error| McpError::internal_error(e.to_string(), None))?;

    Ok(CallToolResult::success(vec![Content::text(
        serde_json::to_string(&response)
            .map_err(|e| McpError::internal_error(e.to_string(), None))?,
    )]))
}
