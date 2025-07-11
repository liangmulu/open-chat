use crate::RuntimeState;
use types::TimestampMillis;

mod active_proposal_tallies;
mod c2c_bot_channel_details;
mod c2c_bot_community_events;
mod c2c_bot_community_summary;
mod c2c_bot_members;
mod c2c_can_issue_access_token;
mod channel_summary;
mod channel_summary_updates;
mod community_events;
mod deleted_message;
mod events;
mod events_by_index;
mod events_window;
mod explore_channels;
mod http_request;
mod invite_code;
mod local_user_index;
mod lookup_members;
mod messages_by_message_index;
mod search_channel;
mod selected_channel_initial;
mod selected_channel_updates;
mod selected_initial;
mod selected_updates;
mod summary;
mod summary_updates;
mod thread_previews;
mod video_call_participants;
mod webhook;

fn check_replica_up_to_date(latest_known_update: Option<TimestampMillis>, state: &RuntimeState) -> Result<(), TimestampMillis> {
    if let Some(ts) = latest_known_update {
        let now = state.env.now();
        if now < ts {
            return Err(now);
        }
    }
    Ok(())
}
