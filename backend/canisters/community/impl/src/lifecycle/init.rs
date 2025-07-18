use crate::lifecycle::{init_env, init_state};
use crate::memory::get_stable_memory_map_memory;
use crate::updates::import_group::commit_group_to_import;
use crate::{Data, mutate_state};
use canister_api_macros::init;
use canister_tracing_macros::trace;
use community_canister::init::Args;
use itertools::Itertools;
use tracing::info;
use utils::env::Environment;

#[init(msgpack = true)]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);
    stable_memory_map::init(get_stable_memory_map_memory());

    let mut env = init_env([0; 32]);

    assert!(args.channels.iter().all_unique());

    let now = env.now();
    let data = Data::new(
        env.canister_id().into(),
        args.created_by_principal,
        args.created_by_user_id,
        args.created_by_user_type,
        args.is_public,
        args.name,
        args.description,
        args.rules,
        args.avatar,
        args.banner,
        args.permissions,
        args.primary_language,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.proposals_bot_user_id,
        args.escrow_canister_id,
        args.internet_identity_canister_id,
        args.gate_config.map(|g| g.into()),
        args.channels,
        args.default_channel_rules,
        args.mark_active_duration,
        args.video_call_operators,
        args.ic_root_key,
        args.test_mode,
        env.rng(),
        now,
    );

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Initialization complete");

    if let Some(group) = args.source_group {
        mutate_state(|state| {
            commit_group_to_import(
                args.created_by_user_id,
                group.group_id,
                group.channel_id,
                group.total_bytes,
                true,
                state,
            );
        });
    }
}
