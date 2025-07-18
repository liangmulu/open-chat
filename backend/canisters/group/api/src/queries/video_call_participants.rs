use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageId, TimestampMillis, VideoCallParticipants};

#[ts_export(group, video_call_participants)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_id: MessageId,
    pub updated_since: Option<TimestampMillis>,
}

#[ts_export(group, video_call_participants)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(VideoCallParticipants),
    Error(OCError),
}
