use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{ChannelId, EventIndex, MessageIndex, TimestampMillis};

#[ts_export(community, events_by_index)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub channel_id: ChannelId,
    pub thread_root_message_index: Option<MessageIndex>,
    pub events: Vec<EventIndex>,
    pub latest_known_update: Option<TimestampMillis>,
}

pub use crate::EventsResponse as Response;
