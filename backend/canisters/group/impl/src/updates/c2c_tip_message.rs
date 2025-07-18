use crate::activity_notifications::handle_activity_notification;
use crate::{GroupEventPusher, RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::TipMessageArgs;
use group_canister::c2c_tip_message::*;
use ledger_utils::format_crypto_amount_with_symbol;
use types::{Achievement, Chat, ChatId, EventIndex, FcmData, GroupMessageTipped, OCResult, UserNotificationPayload};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn c2c_tip_message(args: Args) -> Response {
    execute_update(|state| c2c_tip_message_impl(args, state)).into()
}

fn c2c_tip_message_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    state.data.verify_not_frozen()?;

    let user_id = state.env.caller().into();
    let now = state.env.now();

    let tip_message_args = TipMessageArgs {
        user_id,
        recipient: args.recipient,
        thread_root_message_index: args.thread_root_message_index,
        message_id: args.message_id,
        ledger: args.ledger,
        token_symbol: args.token_symbol.clone(),
        amount: args.amount,
        now,
    };

    let result = state.data.chat.tip_message(
        tip_message_args,
        GroupEventPusher {
            now,
            rng: state.env.rng(),
            queue: &mut state.data.local_user_index_event_sync_queue,
        },
    )?;

    if let Some((message, event_index)) =
        state
            .data
            .chat
            .events
            .message_internal(EventIndex::default(), args.thread_root_message_index, args.message_id.into())
    {
        if let Some(sender) = state.data.chat.members.get(&message.sender) {
            if message.sender != user_id && !sender.user_type().is_bot() {
                let chat_id: ChatId = state.env.canister_id().into();
                let tipped_by_name = args.username;
                let tipped_by_display_name = args.display_name;
                let tip = format_crypto_amount_with_symbol(args.amount, args.decimals, &args.token_symbol);
                let group_avatar_id = state.data.chat.avatar.as_ref().map(|a| a.id);

                // TODO i18n
                let fcm_data = FcmData::for_group(chat_id)
                    .set_body(format!("Tipped your message {tip}"))
                    .set_sender_name_with_alt(&tipped_by_display_name, &tipped_by_name)
                    .set_avatar_id(group_avatar_id);

                let user_notification_payload = UserNotificationPayload::GroupMessageTipped(GroupMessageTipped {
                    chat_id,
                    thread_root_message_index: args.thread_root_message_index,
                    message_index: message.message_index,
                    message_event_index: event_index,
                    group_name: state.data.chat.name.value.clone(),
                    tipped_by: user_id,
                    tipped_by_name,
                    tipped_by_display_name,
                    tip,
                    group_avatar_id: state.data.chat.avatar.as_ref().map(|a| a.id),
                });

                state.push_notification(Some(user_id), vec![message.sender], user_notification_payload, fcm_data);

                state.push_event_to_user(
                    message.sender,
                    GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                        chat: Chat::Group(chat_id),
                        thread_root_message_index: args.thread_root_message_index,
                        message_index: message.message_index,
                        message_id: message.message_id,
                        event_index,
                        activity: MessageActivity::Tip,
                        timestamp: now,
                        user_id: Some(user_id),
                    }),
                    now,
                );

                state.notify_user_of_achievement(message.sender, Achievement::HadMessageTipped, now);
            }
        }
    }

    state.push_bot_notification(result.bot_notification);
    handle_activity_notification(state);
    Ok(())
}
