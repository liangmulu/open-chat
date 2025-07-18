use serde::{Deserialize, Serialize};
use ts_export::ts_export;
use types::UnitResult;

#[ts_export(group, toggle_mute_notifications)]
#[derive(Serialize, Deserialize, Debug)]
pub struct Args {
    pub mute: bool,
}

pub type Response = UnitResult;
