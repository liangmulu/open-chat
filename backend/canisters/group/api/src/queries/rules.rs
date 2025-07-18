use oc_error_codes::OCError;
use serde::{Deserialize, Serialize};
use ts_export::ts_export;

#[ts_export(group, rules)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub invite_code: Option<u64>,
}

#[ts_export(group, rules)]
#[derive(Serialize, Deserialize, Debug)]
pub enum Response {
    Success(SuccessResult),
    Error(OCError),
}

#[ts_export(group, rules)]
#[derive(Serialize, Deserialize, Debug)]
pub struct SuccessResult {
    pub rules: Option<String>,
}
