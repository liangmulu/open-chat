use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use community_canister::c2c_can_issue_access_token;
use jwt::Claims;
use local_user_index_canister::access_token_v2::{self, Response::*, *};
use rand::SeedableRng;
use rand::rngs::StdRng;
use serde::Serialize;
use types::c2c_can_issue_access_token::{
    AccessTypeArgs, BotActionByCommandArgs, JoinVideoCallArgs, MarkVideoCallAsEndedArgs, StartVideoCallArgs,
};
use types::{AutonomousBotScope, BotActionByCommandClaims, BotCommand, Chat, JoinOrEndVideoCallClaims, StartVideoCallClaims};

#[query(composite = true, candid = true, msgpack = true)]
#[trace]
async fn access_token_v2(args_wrapper: Args) -> Response {
    let Ok(args_wrapper) = ArgsInternal::from(args_wrapper) else {
        return InternalError("Failed to parse arguments".to_string());
    };

    let PrepareResult { scope, access_type_args } = match read_state(|state| prepare(&args_wrapper, state)) {
        Ok(r) => r,
        Err(response) => return response,
    };

    if let Err(error_response) = can_issue_access_token(scope, &access_type_args).await {
        return error_response;
    };

    let token_type_name = args_wrapper.type_name().to_string();

    mutate_state(|state| {
        let chat = args_wrapper.chat();

        if let ArgsInternal::BotActionByCommand(args) = &args_wrapper {
            let command_args = args.command.args.clone();

            let custom_claims = BotActionByCommandClaims {
                bot: args.bot_id,
                scope: args.scope.clone(),
                bot_api_gateway: state.env.canister_id(),
                granted_permissions: access_type_args.requested_permissions().unwrap(),
                command: BotCommand {
                    name: args.command.name.clone(),
                    args: command_args,
                    initiator: access_type_args.initiator(),
                    meta: args.command.meta.clone(),
                },
            };
            return build_token(token_type_name, custom_claims, state);
        }

        match access_type_args {
            AccessTypeArgs::StartVideoCall(args) => {
                let custom_claims = StartVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
                    call_type: args.call_type,
                    is_diamond: args.is_diamond,
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::JoinVideoCall(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
                };
                build_token(token_type_name, custom_claims, state)
            }
            AccessTypeArgs::MarkVideoCallAsEnded(args) => {
                let custom_claims = JoinOrEndVideoCallClaims {
                    user_id: args.initiator,
                    chat_id: chat.unwrap(),
                };
                build_token(token_type_name, custom_claims, state)
            }
            _ => unreachable!(),
        }
    })
}

struct PrepareResult {
    scope: AutonomousBotScope,
    access_type_args: AccessTypeArgs,
}

fn prepare(args_outer: &ArgsInternal, state: &RuntimeState) -> Result<PrepareResult, Response> {
    let Some(user) = state
        .data
        .global_users
        .get_by_principal(&state.env.caller())
        .filter(|u| !u.user_type.is_bot())
    else {
        return Err(Response::NotAuthorized);
    };

    if let ArgsInternal::BotActionByCommand(args) = args_outer {
        let bot = state.data.bots.get(&args.bot_id).ok_or(Response::NotAuthorized)?;

        let command = bot
            .commands
            .iter()
            .find(|c| c.name == args.command.name)
            .ok_or(Response::NotAuthorized)?;

        return Ok(PrepareResult {
            scope: args.scope.clone().into(),
            access_type_args: AccessTypeArgs::BotActionByCommand(BotActionByCommandArgs {
                bot_id: args.bot_id,
                initiator: user.user_id,
                initiator_role: command.default_role.unwrap_or_default(),
                requested_permissions: command.permissions.clone(),
            }),
        });
    }

    let user_id = user.user_id;
    let is_diamond = state.data.global_users.is_diamond_member(&user_id, state.env.now());

    let result = match args_outer {
        ArgsInternal::StartVideoCall(args) => PrepareResult {
            scope: AutonomousBotScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::StartVideoCall(StartVideoCallArgs {
                initiator: user_id,
                call_type: args.call_type,
                is_diamond,
            }),
        },
        ArgsInternal::JoinVideoCall(args) => PrepareResult {
            scope: AutonomousBotScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::JoinVideoCall(JoinVideoCallArgs {
                initiator: user_id,
                is_diamond,
            }),
        },
        ArgsInternal::MarkVideoCallAsEnded(args) => PrepareResult {
            scope: AutonomousBotScope::Chat(args.chat),
            access_type_args: AccessTypeArgs::MarkVideoCallAsEnded(MarkVideoCallAsEndedArgs { initiator: user_id }),
        },
        _ => unreachable!(),
    };

    Ok(result)
}

fn build_token<T: Serialize>(token_type_name: String, custom_claims: T, state: &mut RuntimeState) -> Response {
    if !state.data.oc_key_pair.is_initialised() {
        return InternalError("OC Secret not set".to_string());
    };

    let mut rng = StdRng::from_seed(state.env.entropy());

    let claims = Claims::new(
        state.env.now() + 300_000, // Token valid for 5 mins from now
        token_type_name,
        custom_claims,
    );

    match jwt::sign_and_encode_token(state.data.oc_key_pair.secret_key_der(), claims, &mut rng) {
        Ok(token) => Success(token),
        Err(err) => InternalError(format!("{err:?}")),
    }
}

#[derive(Debug)]
enum ArgsInternal {
    StartVideoCall(access_token_v2::StartVideoCallArgs),
    JoinVideoCall(access_token_v2::JoinVideoCallArgs),
    MarkVideoCallAsEnded(access_token_v2::MarkVideoCallAsEndedArgs),
    BotActionByCommand(access_token_v2::BotActionByCommandArgs),
}

impl ArgsInternal {
    pub fn from(value: Args) -> Result<Self, Box<dyn std::error::Error + Sync + Send>> {
        match value {
            Args::StartVideoCall(args) => Ok(ArgsInternal::StartVideoCall(args)),
            Args::JoinVideoCall(args) => Ok(ArgsInternal::JoinVideoCall(args)),
            Args::MarkVideoCallAsEnded(args) => Ok(ArgsInternal::MarkVideoCallAsEnded(args)),
            Args::BotActionByCommand(args) => Ok(ArgsInternal::BotActionByCommand(args)),
        }
    }

    pub fn type_name(&self) -> &str {
        match self {
            Self::StartVideoCall(_) => "StartVideoCall",
            Self::JoinVideoCall(_) => "JoinVideoCall",
            Self::MarkVideoCallAsEnded(_) => "MarkVideoCallAsEnded",
            Self::BotActionByCommand(_) => "BotActionByCommand",
        }
    }

    pub fn chat(&self) -> Option<Chat> {
        match self {
            Self::StartVideoCall(args) => Some(args.chat),
            Self::JoinVideoCall(args) => Some(args.chat),
            Self::MarkVideoCallAsEnded(args) => Some(args.chat),
            Self::BotActionByCommand(args) => args.scope.chat(None),
        }
    }
}

async fn can_issue_access_token(scope: AutonomousBotScope, access_type_args: &AccessTypeArgs) -> Result<(), Response> {
    let c2c_response = match scope {
        AutonomousBotScope::Chat(Chat::Direct(chat_id)) => {
            user_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), access_type_args).await
        }
        AutonomousBotScope::Chat(Chat::Group(chat_id)) => {
            group_canister_c2c_client::c2c_can_issue_access_token_v2(chat_id.into(), access_type_args).await
        }
        AutonomousBotScope::Chat(Chat::Channel(community_id, channel_id)) => {
            community_canister_c2c_client::c2c_can_issue_access_token(
                community_id.into(),
                &community_canister::c2c_can_issue_access_token::Args {
                    channel_id: Some(channel_id),
                    access_type: access_type_args.clone(),
                },
            )
            .await
        }
        AutonomousBotScope::Community(community_id) => {
            community_canister_c2c_client::c2c_can_issue_access_token(
                community_id.into(),
                &community_canister::c2c_can_issue_access_token::Args {
                    channel_id: None,
                    access_type: access_type_args.clone(),
                },
            )
            .await
        }
    };

    match c2c_response {
        Ok(c2c_can_issue_access_token::Response::Success) => Ok(()),
        Ok(c2c_can_issue_access_token::Response::Failure) => Err(NotAuthorized),
        Err(err) => Err(InternalError(format!("{err:?}"))),
    }
}
