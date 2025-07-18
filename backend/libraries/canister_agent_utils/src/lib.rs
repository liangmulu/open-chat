use candid::Principal;
use ic_agent::identity::{BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use ic_utils::interfaces::ManagementCanister;
use itertools::Itertools;
use std::fmt::{Display, Formatter};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use types::{BuildVersion, CanisterId, CanisterWasm};

#[derive(Clone, Debug)]
pub enum CanisterName {
    AirdropBot,
    Community,
    CyclesDispenser,
    Escrow,
    EventRelay,
    EventStore,
    Group,
    GroupIndex,
    Identity,
    LocalUserIndex,
    MarketMaker,
    NeuronController,
    NotificationsIndex,
    OnlineUsers,
    OpenChatInstaller,
    ProposalsBot,
    Registry,
    SignInWithEmail,
    SignInWithEthereum,
    SignInWithSolana,
    StorageBucket,
    StorageIndex,
    Translations,
    User,
    UserIndex,
}

impl FromStr for CanisterName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "airdrop_bot" => Ok(CanisterName::AirdropBot),
            "community" => Ok(CanisterName::Community),
            "cycles_dispenser" => Ok(CanisterName::CyclesDispenser),
            "escrow" => Ok(CanisterName::Escrow),
            "event_relay" => Ok(CanisterName::EventRelay),
            "event_store" => Ok(CanisterName::EventStore),
            "group" => Ok(CanisterName::Group),
            "group_index" => Ok(CanisterName::GroupIndex),
            "identity" => Ok(CanisterName::Identity),
            "local_user_index" => Ok(CanisterName::LocalUserIndex),
            "market_maker" => Ok(CanisterName::MarketMaker),
            "neuron_controller" => Ok(CanisterName::NeuronController),
            "notifications_index" => Ok(CanisterName::NotificationsIndex),
            "online_users" => Ok(CanisterName::OnlineUsers),
            "openchat_installer" => Ok(CanisterName::OpenChatInstaller),
            "proposals_bot" => Ok(CanisterName::ProposalsBot),
            "registry" => Ok(CanisterName::Registry),
            "sign_in_with_email" => Ok(CanisterName::SignInWithEmail),
            "sign_in_with_ethereum" => Ok(CanisterName::SignInWithEthereum),
            "sign_in_with_solana" => Ok(CanisterName::SignInWithSolana),
            "storage_bucket" => Ok(CanisterName::StorageBucket),
            "storage_index" => Ok(CanisterName::StorageIndex),
            "translations" => Ok(CanisterName::Translations),
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            _ => Err(format!("Unrecognised canister name: {s}")),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::AirdropBot => "airdrop_bot",
            CanisterName::Community => "community",
            CanisterName::CyclesDispenser => "cycles_dispenser",
            CanisterName::Escrow => "escrow",
            CanisterName::EventRelay => "event_relay",
            CanisterName::EventStore => "event_store",
            CanisterName::Group => "group",
            CanisterName::GroupIndex => "group_index",
            CanisterName::Identity => "identity",
            CanisterName::LocalUserIndex => "local_user_index",
            CanisterName::MarketMaker => "market_maker",
            CanisterName::NeuronController => "neuron_controller",
            CanisterName::NotificationsIndex => "notifications_index",
            CanisterName::OnlineUsers => "online_users",
            CanisterName::OpenChatInstaller => "openchat_installer",
            CanisterName::ProposalsBot => "proposals_bot",
            CanisterName::Registry => "registry",
            CanisterName::SignInWithEmail => "sign_in_with_email",
            CanisterName::SignInWithEthereum => "sign_in_with_ethereum",
            CanisterName::SignInWithSolana => "sign_in_with_solana",
            CanisterName::StorageBucket => "storage_bucket",
            CanisterName::StorageIndex => "storage_index",
            CanisterName::Translations => "translations",
            CanisterName::User => "user",
            CanisterName::UserIndex => "user_index",
        };

        f.write_str(name)
    }
}

#[derive(Debug)]
pub struct CanisterIds {
    pub openchat_installer: CanisterId,
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub local_user_index: CanisterId,
    pub identity: CanisterId,
    pub online_users: CanisterId,
    pub proposals_bot: CanisterId,
    pub airdrop_bot: CanisterId,
    pub storage_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub registry: CanisterId,
    pub market_maker: CanisterId,
    pub neuron_controller: CanisterId,
    pub escrow: CanisterId,
    pub translations: CanisterId,
    pub event_relay: CanisterId,
    pub event_store: CanisterId,
    pub sign_in_with_email: CanisterId,
    pub sign_in_with_ethereum: CanisterId,
    pub sign_in_with_solana: CanisterId,
    pub nns_root: CanisterId,
    pub nns_governance: CanisterId,
    pub nns_internet_identity: CanisterId,
    pub nns_ledger: CanisterId,
    pub nns_cmc: CanisterId,
    pub nns_sns_wasm: CanisterId,
    pub nns_index: CanisterId,
    pub website: CanisterId,
}

pub fn get_dfx_identity(name: &str) -> Box<dyn Identity> {
    let config_dfx_dir_path = get_user_dfx_config_dir().unwrap();
    let pem_path = config_dfx_dir_path.join("identity").join(name).join("identity.pem");
    if !Path::exists(pem_path.as_path()) {
        panic!("Pem file not found at: {}", pem_path.as_path().display());
    }
    if let Ok(identity) = BasicIdentity::from_pem_file(pem_path.as_path()) {
        Box::new(identity)
    } else if let Ok(identity) = Secp256k1Identity::from_pem_file(pem_path.as_path()) {
        Box::new(identity)
    } else {
        panic!("Failed to create identity from pem file: {}", pem_path.as_path().display());
    }
}

pub async fn build_ic_agent(url: String, identity: Box<dyn Identity>) -> Agent {
    let mainnet = is_mainnet(&url);
    let timeout = std::time::Duration::from_secs(60 * 5);

    let agent = Agent::builder()
        .with_url(url)
        .with_boxed_identity(identity)
        .with_ingress_expiry(timeout)
        .build()
        .expect("Failed to build IC agent");

    if !mainnet {
        agent.fetch_root_key().await.expect("Couldn't fetch root key");
    }

    agent
}

pub async fn set_controllers(
    management_canister: &ManagementCanister<'_>,
    canister_id: &CanisterId,
    controllers: Vec<Principal>,
) {
    let mut request = management_canister.update_settings(canister_id);
    for controller in controllers {
        request = request.with_controller(controller);
    }
    request.call_and_wait().await.expect("Failed to set controllers");
}

pub async fn install_wasm(
    management_canister: &ManagementCanister<'_>,
    canister_id: &CanisterId,
    wasm_bytes: &[u8],
    init_args_bytes: Vec<u8>,
) {
    management_canister
        .install_code(canister_id, wasm_bytes)
        .with_raw_arg(init_args_bytes)
        .call_and_wait()
        .await
        .expect("Failed to install wasm");
}

pub fn get_canister_wasm(canister_name: impl ToString, version: BuildVersion) -> CanisterWasm {
    let mut local_bin_path =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("Failed to read CARGO_MANIFEST_DIR env variable"));
    local_bin_path.push("wasms");

    let file_name = file_by_prefix(&canister_name.to_string(), &local_bin_path)
        .unwrap_or_else(|| panic!("Couldn't find file for canister '{}'", canister_name.to_string()));

    let file_path = local_bin_path.join(file_name);
    let bytes = read_file(file_path);

    CanisterWasm {
        module: bytes.into(),
        version,
    }
}

pub fn read_file(file_path: PathBuf) -> Vec<u8> {
    let mut file = File::open(&file_path).unwrap_or_else(|_| panic!("Failed to open file: {}", file_path.to_str().unwrap()));
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).expect("Failed to read file");
    bytes
}

pub fn is_mainnet(url: &str) -> bool {
    url.contains("ic0.app")
}

fn file_by_prefix(file_name_prefix: &str, dir: &PathBuf) -> Option<String> {
    let dir = std::fs::read_dir(dir).unwrap_or_else(|_| panic!("Expect to read_dir {dir:#?}"));

    dir.filter_map(|f| f.ok())
        .filter_map(|f| f.file_name().to_str().map(|s| s.to_string()))
        .filter(|f| f.starts_with(file_name_prefix) && f.ends_with(".wasm.gz"))
        .sorted_unstable_by_key(|f| f.len())
        .next()
}

fn get_user_dfx_config_dir() -> Option<PathBuf> {
    let config_root = std::env::var_os("DFX_CONFIG_ROOT");
    let home = std::env::var_os("HOME")?;
    let root = config_root.unwrap_or(home);
    Some(PathBuf::from(root).join(".config").join("dfx"))
}
