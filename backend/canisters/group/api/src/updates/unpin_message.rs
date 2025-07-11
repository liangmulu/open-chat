use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::{MessageIndex, PushEventResult};

#[ts_export(group, unpin_message)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub message_index: MessageIndex,
}

#[ts_export(group, unpin_message)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    SuccessV2(PushEventResult),
    Error(OCError),
}
