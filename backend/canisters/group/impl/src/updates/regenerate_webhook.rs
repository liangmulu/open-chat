use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::regenerate_webhook::*;
use oc_error_codes::OCErrorCode;
use types::OCResult;

#[update(msgpack = true)]
#[trace]
fn regenerate_webhook(args: Args) -> Response {
    match execute_update(|state| regenerate_webhook_impl(args, state)) {
        Ok(result) => Response::Success(result),
        Err(error) => Response::Error(error),
    }
}

fn regenerate_webhook_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;

    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();

    if !state.data.chat.webhooks.regenerate(args.id, state.env.rng(), now) {
        return Err(OCErrorCode::WebhookNotFound.into());
    }

    let webhook = state.data.chat.webhooks.get(&args.id).unwrap();

    let result = SuccessResult {
        secret: webhook.secret.clone(),
    };

    handle_activity_notification(state);
    Ok(result)
}
