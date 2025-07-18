use crate::guards::caller_is_owner;
use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use types::{InstalledBotDetails, UserId};
use user_canister::initial_state::{Response::*, *};

#[query(guard = "caller_is_owner", msgpack = true)]
fn initial_state(_args: Args) -> Response {
    read_state(initial_state_impl)
}

fn initial_state_impl(state: &RuntimeState) -> Response {
    let now = state.env.now();
    let my_user_id: UserId = state.env.canister_id().into();
    let avatar_id = state.data.avatar.value.as_ref().map(|a| a.id);
    let blocked_users = state.data.blocked_users.value.iter().copied().collect();

    let direct_chats = DirectChatsInitial {
        summaries: state.data.direct_chats.iter().map(|d| d.to_summary(my_user_id)).collect(),
        pinned: state.data.direct_chats.pinned().to_vec(),
    };

    let group_chats = GroupChatsInitial {
        summaries: state.data.group_chats.iter().map(|g| g.to_summary()).collect(),
        pinned: state.data.group_chats.pinned().to_vec(),
    };

    let communities = CommunitiesInitial {
        summaries: state.data.communities.iter().map(|c| c.to_summary()).collect(),
    };

    let favourite_chats = FavouriteChatsInitial {
        chats: state.data.favourite_chats.chats().to_vec(),
        pinned: state.data.favourite_chats.pinned().to_vec(),
    };

    let bots = state
        .data
        .bots
        .iter()
        .map(|(user_id, bot)| InstalledBotDetails {
            user_id: *user_id,
            added_by: bot.added_by,
            permissions: bot.permissions.clone(),
            autonomous_permissions: bot.autonomous_permissions.clone(),
        })
        .collect();

    Success(SuccessResult {
        timestamp: now,
        direct_chats,
        group_chats,
        favourite_chats,
        communities,
        avatar_id,
        blocked_users,
        suspended: state.data.suspended.value,
        pin_number_settings: state.data.pin_number.enabled().then(|| state.data.pin_number.settings(now)),
        local_user_index_canister_id: state.data.local_user_index_canister_id,
        achievements: state.data.chit_events.achievements(None),
        achievements_last_seen: state.data.achievements_last_seen,
        total_chit_earned: state.data.chit_events.total_chit_earned(),
        chit_balance: state.data.chit_events.balance_for_month_by_timestamp(now),
        streak: state.data.streak.days(now),
        streak_ends: state.data.streak.ends(),
        max_streak: state.data.streak.max_streak(),
        streak_insurance: state.data.streak.streak_insurance(now),
        next_daily_claim: state.data.streak.next_claim(),
        is_unique_person: state.data.unique_person_proof.is_some(),
        wallet_config: state.data.wallet_config.value.clone(),
        referrals: state.data.referrals.list(),
        message_activity_summary: state.data.message_activity_events.summary(),
        bots,
        btc_address: state.data.btc_address.as_ref().map(|a| a.value.clone()),
    })
}
