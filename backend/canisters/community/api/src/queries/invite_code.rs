use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::Empty;

pub type Args = Empty;

#[ts_export(community, invite_code)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(community, invite_code)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub code: Option<u64>,
}
