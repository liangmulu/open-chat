use crate::{
    RuntimeState, activity_notifications::handle_activity_notification, execute_update_async, jobs,
    model::events::CommunityEventInternal, mutate_state, read_state,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::change_role::*;
use group_community_common::ExpiringMember;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, CommunityRole, CommunityRoleChanged, OCResult, UserId};
use user_index_canister_c2c_client::lookup_user;

#[update(msgpack = true)]
#[trace]
async fn change_role(args: Args) -> Response {
    execute_update_async(|| change_role_impl(args)).await
}

async fn change_role_impl(args: Args) -> Response {
    let PrepareResult {
        caller_id,
        user_index_canister_id,
        is_caller_owner,
        is_user_owner,
    } = match read_state(|state| prepare(args.user_id, state)) {
        Ok(result) => result,
        Err(error) => return Response::Error(error),
    };

    // Either lookup whether the caller is a platform moderator so they can promote themselves to owner
    // Or lookup whether the user is a platform moderator to prevent them being demoted from owner
    let mut is_caller_platform_moderator = false;
    let mut is_user_platform_moderator = false;
    let lookup_caller = !is_caller_owner && args.new_role.is_owner() && caller_id == args.user_id;
    let lookup_target = is_caller_owner && is_user_owner && caller_id != args.user_id;

    if lookup_caller || lookup_target {
        let user_id = if lookup_caller { caller_id } else { args.user_id };
        match lookup_user(user_id.into(), user_index_canister_id).await {
            Ok(Some(user)) => {
                if user.is_platform_moderator {
                    if lookup_caller {
                        is_caller_platform_moderator = true;
                    } else {
                        is_user_platform_moderator = true;
                    }
                }
            }
            Ok(_) => return Response::Error(OCErrorCode::InitiatorNotAuthorized.into()),
            Err(error) => return Response::Error(error.into()),
        };
    }

    mutate_state(|state| {
        commit(
            args,
            caller_id,
            is_caller_platform_moderator,
            is_user_platform_moderator,
            state,
        )
    })
    .into()
}

struct PrepareResult {
    caller_id: UserId,
    user_index_canister_id: CanisterId,
    is_caller_owner: bool,
    is_user_owner: bool,
}

fn prepare(user_id: UserId, state: &RuntimeState) -> OCResult<PrepareResult> {
    let member = state.get_calling_member(true)?;

    Ok(PrepareResult {
        caller_id: member.user_id,
        user_index_canister_id: state.data.user_index_canister_id,
        is_caller_owner: member.role().is_owner(),
        is_user_owner: state
            .data
            .members
            .get_by_user_id(&user_id)
            .is_some_and(|p| p.role().is_owner()),
    })
}

fn commit(
    args: Args,
    caller_id: UserId,
    is_caller_platform_moderator: bool,
    is_user_platform_moderator: bool,
    state: &mut RuntimeState,
) -> OCResult {
    state.data.verify_not_frozen()?;

    let now = state.env.now();
    let result = state.data.members.change_role(
        caller_id,
        args.user_id,
        args.new_role,
        &state.data.permissions,
        is_caller_platform_moderator,
        is_user_platform_moderator,
        now,
    )?;

    // Owners can't "lapse" so either add or remove user from expiry list if they lose or gain owner status
    if let Some(gate_expiry) = state.data.gate_config.value.as_ref().and_then(|gc| gc.expiry()) {
        if matches!(args.new_role, CommunityRole::Owner) {
            state.data.expiring_members.remove_member(args.user_id, None);
        } else if matches!(result.prev_role, CommunityRole::Owner) {
            state.data.expiring_members.push(ExpiringMember {
                expires: now + gate_expiry,
                channel_id: None,
                user_id: args.user_id,
            });
        }
    }

    let event = CommunityRoleChanged {
        user_ids: vec![args.user_id],
        old_role: result.prev_role,
        new_role: args.new_role,
        changed_by: caller_id,
    };
    state.push_community_event(CommunityEventInternal::RoleChanged(Box::new(event)));

    jobs::expire_members::start_job_if_required(state);

    handle_activity_notification(state);
    Ok(())
}
