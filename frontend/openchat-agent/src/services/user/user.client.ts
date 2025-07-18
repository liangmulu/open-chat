import type { HttpAgent, Identity } from "@dfinity/agent";
import type {
    AcceptP2PSwapResponse,
    AddRemoveReactionResponse,
    ApproveTransferResponse,
    ArchiveChatResponse,
    BlobReference,
    BlockUserResponse,
    CancelP2PSwapResponse,
    CandidateGroupChat,
    ChannelIdentifier,
    ChatEvent,
    ChatIdentifier,
    ChitEventsRequest,
    ChitEventsResponse,
    ClaimDailyChitResponse,
    CommunityIdentifier,
    CommunitySummary,
    CreateCommunityResponse,
    CreatedUser,
    CreateGroupResponse,
    CryptocurrencyDetails,
    DeleteCommunityResponse,
    DeletedDirectMessageResponse,
    DeleteGroupResponse,
    DeleteMessageResponse,
    DirectChatIdentifier,
    EditMessageResponse,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    ExchangeTokenSwapArgs,
    GrantedBotPermissions,
    GroupChatIdentifier,
    IndexRange,
    InitialStateResponse,
    JoinVideoCallResponse,
    LeaveCommunityResponse,
    LeaveGroupResponse,
    ManageFavouritesResponse,
    MarkReadRequest,
    MarkReadResponse,
    Message,
    MessageActivityFeedResponse,
    MessageContext,
    NamedAccount,
    OptionUpdate,
    PayForStreakInsuranceResponse,
    PendingCryptocurrencyTransfer,
    PendingCryptocurrencyWithdrawal,
    PinChatResponse,
    PublicProfile,
    Rules,
    SaveCryptoAccountResponse,
    SearchDirectChatResponse,
    SendMessageResponse,
    SetBioResponse,
    SetMessageReminderResponse,
    SetPinNumberResponse,
    SwapTokensResponse,
    ThreadRead,
    TipMessageResponse,
    ToggleMuteNotificationResponse,
    TokenSwapStatusResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinChatResponse,
    UpdatesResponse,
    Verification,
    WalletConfig,
    WithdrawBtcResponse,
    WithdrawCryptocurrencyResponse,
} from "openchat-shared";
import {
    isSuccessfulEventsResponse,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
    ResponseTooLargeError,
    toBigInt32,
} from "openchat-shared";
import type { AgentConfig } from "../../config";
import {
    Empty as TEmpty,
    UnitResult,
    UserAcceptP2pSwapArgs,
    UserAcceptP2pSwapResponse,
    UserAddHotGroupExclusionsArgs,
    UserAddHotGroupExclusionsResponse,
    UserAddReactionArgs,
    UserApproveTransferArgs,
    UserArchiveUnarchiveChatsArgs,
    UserArchiveUnarchiveChatsResponse,
    UserBioResponse,
    UserBlockUserArgs,
    UserCancelMessageReminderArgs,
    UserCancelMessageReminderResponse,
    UserCancelP2pSwapArgs,
    UserChatInList,
    UserChitEventsArgs,
    UserChitEventsResponse,
    UserClaimDailyChitArgs,
    UserClaimDailyChitResponse,
    UserConfigureWalletArgs,
    UserConfigureWalletResponse,
    UserCreateCommunityArgs,
    UserCreateCommunityResponse,
    UserCreateGroupArgs,
    UserCreateGroupResponse,
    UserDeleteCommunityArgs,
    UserDeleteDirectChatArgs,
    UserDeletedMessageArgs,
    UserDeletedMessageResponse,
    UserDeleteGroupArgs,
    UserDeleteMessagesArgs,
    UserEditMessageArgs,
    UserEventsArgs,
    UserEventsByIndexArgs,
    UserEventsResponse,
    UserEventsWindowArgs,
    UserGenerateBtcAddressResponse,
    UserInitialStateResponse,
    UserJoinVideoCallArgs,
    UserLeaveCommunityArgs,
    UserLeaveGroupArgs,
    UserLocalUserIndexResponse,
    UserManageFavouriteChatsArgs,
    UserMarkAchievementsSeenArgs,
    UserMarkAchievementsSeenResponse,
    UserMarkMessageActivityFeedReadArgs,
    UserMarkMessageActivityFeedReadResponse,
    UserMarkReadArgs,
    UserMarkReadChannelMessagesRead,
    UserMarkReadChatMessagesRead,
    UserMarkReadResponse,
    UserMessageActivityFeedArgs,
    UserMessageActivityFeedResponse,
    UserMuteNotificationsArgs,
    UserNamedAccount,
    UserPayForStreakInsuranceArgs,
    UserPinChatArgs,
    UserPublicProfileResponse,
    UserRemoveReactionArgs,
    UserReportMessageArgs,
    UserSavedCryptoAccountsResponse,
    UserSearchMessagesArgs,
    UserSearchMessagesResponse,
    UserSendMessageArgs,
    UserSendMessageResponse,
    UserSendMessageWithTransferToChannelArgs,
    UserSendMessageWithTransferToChannelResponse,
    UserSendMessageWithTransferToGroupArgs,
    UserSendMessageWithTransferToGroupResponse,
    UserSetAvatarArgs,
    UserSetBioArgs,
    UserSetCommunityIndexesArgs,
    UserSetCommunityIndexesResponse,
    UserSetMessageReminderArgs,
    UserSetMessageReminderResponse,
    UserSetPinNumberArgs,
    UserSwapTokensArgs,
    UserSwapTokensResponse,
    UserTipMessageArgs,
    UserTipMessageResponse,
    UserTokenSwapStatusArgs,
    UserTokenSwapStatusResponse,
    UserUnblockUserArgs,
    UserUndeleteMessagesArgs,
    UserUndeleteMessagesResponse,
    UserUnpinChatArgs,
    UserUpdateBotArgs,
    UserUpdateChatSettingsArgs,
    UserUpdatesArgs,
    UserUpdatesResponse,
    UserWithdrawBtcArgs,
    UserWithdrawBtcResponse,
    UserWithdrawCryptoArgs,
    UserWithdrawCryptoResponse,
} from "../../typebox";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
    toVoid,
} from "../../utils/mapping";
import { setChitInfoInCache } from "../../utils/userCache";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
import {
    acceptP2PSwapSuccess,
    apiChatIdentifier,
    apiCommunityPermissions,
    apiExternalBotPermissions,
    apiGroupPermissions,
    apiMaybeAccessGateConfig,
    apiMessageContent,
    apiPendingCryptocurrencyWithdrawal,
    apiReplyContextArgs,
    createGroupSuccess,
    deletedMessageSuccess,
    getEventsSuccess,
    isSuccess,
    mapResult,
    undeleteMessageSuccess,
    unitResult,
} from "../common/chatMappersV2";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import { DataClient } from "../data/data.client";
import {
    apiExchangeArgs,
    apiVerification,
    apiWalletConfig,
    archiveChatResponse,
    chitEventsResponse,
    claimDailyChitResponse,
    createCommunitySuccess,
    getUpdatesResponse,
    initialStateResponse,
    messageActivityFeedResponse,
    publicProfileResponse,
    savedCryptoAccountsResponse,
    searchDirectChatSuccess,
    sendMessageResponse,
    sendMessageWithTransferToChannelResponse,
    sendMessageWithTransferToGroupResponse,
    swapTokensSuccess,
    tipMessageResponse,
    tokenSwapStatusResponse,
    withdrawCryptoResponse,
} from "./mappersV2";

export class UserClient extends MsgpackCanisterAgent {
    userId: string;
    private chatId: DirectChatIdentifier;

    constructor(
        userId: string,
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private db: Database,
    ) {
        super(identity, agent, userId, "User");
        this.userId = userId;
        this.chatId = { kind: "direct_chat", userId: userId };
    }

    private setCachedEvents(
        chatId: ChatIdentifier,
        resp: EventsResponse<ChatEvent>,
        threadRootMessageIndex?: number,
    ): EventsResponse<ChatEvent> {
        setCachedEvents(this.db, chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        chatId: DirectChatIdentifier,
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                chatId,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex))
                .then((resp) => {
                    if (isSuccessfulEventsResponse(resp)) {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    manageFavouriteChats(
        toAdd: ChatIdentifier[],
        toRemove: ChatIdentifier[],
    ): Promise<ManageFavouritesResponse> {
        return this.executeMsgpackUpdate(
            "manage_favourite_chats",
            {
                to_add: toAdd.map(apiChatIdentifier),
                to_remove: toRemove.map(apiChatIdentifier),
            },
            unitResult,
            UserManageFavouriteChatsArgs,
            UnitResult,
        );
    }

    getInitialState(): Promise<InitialStateResponse> {
        return this.executeMsgpackQuery(
            "initial_state",
            {},
            initialStateResponse,
            TEmpty,
            UserInitialStateResponse,
        );
    }

    getUpdates(updatesSince: bigint): Promise<UpdatesResponse> {
        const args = {
            updates_since: updatesSince,
        };
        return this.executeMsgpackQuery(
            "updates",
            args,
            getUpdatesResponse,
            UserUpdatesArgs,
            UserUpdatesResponse,
        );
    }

    createCommunity(
        community: CommunitySummary,
        rules: Rules,
        defaultChannels: string[],
        defaultChannelRules: Rules,
    ): Promise<CreateCommunityResponse> {
        return this.executeMsgpackUpdate(
            "create_community",
            {
                is_public: community.public,
                name: community.name,
                description: community.description,
                history_visible_to_new_joiners: community.historyVisible,
                avatar: mapOptional(community.avatar?.blobData, (data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }),
                banner: mapOptional(community.banner?.blobData, (data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }),
                permissions: apiCommunityPermissions(community.permissions),
                rules,
                gate_config: apiMaybeAccessGateConfig(community.gateConfig),
                default_channels: defaultChannels,
                default_channel_rules: defaultChannelRules,
                primary_language: community.primaryLanguage,
            },
            (resp) => mapResult(resp, createCommunitySuccess),
            UserCreateCommunityArgs,
            UserCreateCommunityResponse,
        );
    }

    createGroup(group: CandidateGroupChat): Promise<CreateGroupResponse> {
        return this.executeMsgpackUpdate(
            "create_group",
            {
                is_public: group.public,
                name: group.name,
                description: group.description,
                history_visible_to_new_joiners: group.historyVisible,
                avatar: mapOptional(group.avatar?.blobData, (data) => {
                    return {
                        id: DataClient.newBlobId(),
                        data,
                        mime_type: "image/jpg",
                    };
                }),
                permissions_v2: apiGroupPermissions(group.permissions),
                rules: group.rules,
                gate_config: apiMaybeAccessGateConfig(group.gateConfig),
                events_ttl: group.eventsTTL,
                messages_visible_to_non_members: group.messagesVisibleToNonMembers,
            },
            (resp) => mapResult(resp, (value) => createGroupSuccess(value, group.id)),
            UserCreateGroupArgs,
            UserCreateGroupResponse,
        );
    }

    deleteGroup(chatId: string): Promise<DeleteGroupResponse> {
        return this.executeMsgpackUpdate(
            "delete_group",
            {
                chat_id: principalStringToBytes(chatId),
            },
            unitResult,
            UserDeleteGroupArgs,
            UnitResult,
        );
    }

    deleteCommunity(id: CommunityIdentifier): Promise<DeleteCommunityResponse> {
        return this.executeMsgpackUpdate(
            "delete_community",
            {
                community_id: principalStringToBytes(id.communityId),
            },
            unitResult,
            UserDeleteCommunityArgs,
            UnitResult,
        );
    }

    getCachedEventsByIndex(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
    ) {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId,
            threadRootMessageIndex,
        });
    }

    chatEventsByIndex(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.getCachedEventsByIndex(eventIndexes, chatId, threadRootMessageIndex).then(
            (res) =>
                this.handleMissingEvents(chatId, res, threadRootMessageIndex, latestKnownUpdate),
        );
    }

    private chatEventsByIndexFromBackend(
        eventIndexes: number[],
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            user_id: principalStringToBytes(chatId.userId),
            events: eventIndexes,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events_by_index",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            UserEventsByIndexArgs,
            UserEventsResponse,
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId },
            messageIndex,
        );
        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.chatEventsWindowFromBackend(chatId, messageIndex, latestKnownUpdate)
                .then((resp) => this.setCachedEvents(chatId, resp))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    chatId,
                                    index,
                                    ascending,
                                    undefined,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.chatEventsWindowFromBackend(
                                    chatId,
                                    index,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => this.setCachedEvents(chatId, resp));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                undefined,
                latestKnownUpdate,
            );
        }
    }

    private async chatEventsWindowFromBackend(
        chatId: DirectChatIdentifier,
        messageIndex: number,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: undefined,
            user_id: principalStringToBytes(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: latestKnownUpdate,
        };
        return this.executeMsgpackQuery(
            "events_window",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            UserEventsWindowArgs,
            UserEventsResponse,
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api");
            return this.chatEventsFromBackend(
                chatId,
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(chatId, resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    chatId,
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) =>
                            this.setCachedEvents(chatId, resp, threadRootMessageIndex),
                        );
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                chatId,
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsFromBackend(
        chatId: DirectChatIdentifier,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            user_id: principalStringToBytes(chatId.userId),
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            start_index: startIndex,
            ascending: ascending,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };

        return this.executeMsgpackQuery(
            "events",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            UserEventsArgs,
            UserEventsResponse,
        );
    }

    setAvatar(bytes: Uint8Array): Promise<BlobReference> {
        const blobId = DataClient.newBlobId();
        return this.executeMsgpackUpdate(
            "set_avatar",
            {
                avatar: {
                    id: blobId,
                    data: bytes,
                    mime_type: "image/jpg",
                },
            },
            isSuccess,
            UserSetAvatarArgs,
            UnitResult,
        ).then((success) => {
            if (success) {
                return {
                    blobId,
                    canisterId: this.userId,
                };
            }
            throw new Error("Unable to set avatar");
        });
    }

    editMessage(
        recipientId: string,
        message: Message,
        threadRootMessageIndex?: number,
        blockLevelMarkdown?: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [this.userId, recipientId])
            .then((content) => {
                const req = {
                    content: apiMessageContent(content ?? message.content),
                    user_id: principalStringToBytes(recipientId),
                    thread_root_message_index: threadRootMessageIndex,
                    message_id: message.messageId,
                    block_level_markdown: blockLevelMarkdown,
                };
                return this.executeMsgpackUpdate(
                    "edit_message_v2",
                    req,
                    unitResult,
                    UserEditMessageArgs,
                    UnitResult,
                );
            });
    }

    sendMessage(
        chatId: DirectChatIdentifier,
        event: EventWrapper<Message>,
        messageFilterFailed: bigint | undefined,
        threadRootMessageIndex: number | undefined,
        pin: string | undefined,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.userId, chatId.userId])
            : dataClient.uploadData(event.event.content, [this.userId, chatId.userId]);

        return uploadContentPromise.then((content) => {
            const newEvent =
                content !== undefined ? { ...event, event: { ...event.event, content } } : event;
            const req = {
                content: apiMessageContent(newEvent.event.content),
                recipient: principalStringToBytes(chatId.userId),
                message_id: newEvent.event.messageId,
                replies_to: mapOptional(newEvent.event.repliesTo, (replyContext) =>
                    apiReplyContextArgs(chatId, replyContext),
                ),
                forwarding: newEvent.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                pin,
                block_level_markdown: newEvent.event.blockLevelMarkdown,
            };
            return this.executeMsgpackUpdate(
                "send_message_v2",
                req,
                (resp) => sendMessageResponse(resp, newEvent.event.sender, chatId.userId),
                UserSendMessageArgs,
                UserSendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [resp, newEvent.event];
                    setCachedMessageFromSendResponse(
                        this.db,
                        chatId,
                        newEvent,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, chatId, newEvent, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    sendMessageWithTransferToGroup(
        groupId: GroupChatIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageWithTransferToGroupToBackend(
            groupId,
            recipientId,
            sender,
            event,
            threadRootMessageIndex,
            rulesAccepted,
            messageFilterFailed,
            pin,
        )
            .then(setCachedMessageFromSendResponse(this.db, groupId, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, groupId, event);
                throw err;
            });
    }

    private sendMessageWithTransferToGroupToBackend(
        groupId: GroupChatIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        const content = apiMessageContent(event.event.content);

        const req = {
            thread_root_message_index: threadRootMessageIndex,
            content,
            sender_name: sender.username,
            sender_display_name: sender.displayName,
            rules_accepted: rulesAccepted,
            mentioned: [],
            message_id: event.event.messageId,
            group_id: principalStringToBytes(groupId.groupId),
            replies_to: mapOptional(event.event.repliesTo, (replyContext) =>
                apiReplyContextArgs(groupId, replyContext),
            ),
            block_level_markdown: true,
            message_filter_failed: messageFilterFailed,
            pin,
        };
        return this.executeMsgpackUpdate(
            "send_message_with_transfer_to_group",
            req,
            (resp) => sendMessageWithTransferToGroupResponse(resp, event.event.sender, recipientId),
            UserSendMessageWithTransferToGroupArgs,
            UserSendMessageWithTransferToGroupResponse,
        ).then((resp) => [resp, event.event]);
    }

    loadSavedCryptoAccounts(): Promise<NamedAccount[]> {
        return this.executeMsgpackQuery(
            "saved_crypto_accounts",
            {},
            savedCryptoAccountsResponse,
            TEmpty,
            UserSavedCryptoAccountsResponse,
        );
    }

    saveCryptoAccount({ name, account }: NamedAccount): Promise<SaveCryptoAccountResponse> {
        return this.executeMsgpackUpdate(
            "save_crypto_account",
            {
                name,
                account,
            },
            unitResult,
            UserNamedAccount,
            UnitResult,
        );
    }

    sendMessageWithTransferToChannel(
        id: ChannelIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);
        return this.sendMessageWithTransferToChannelToBackend(
            id,
            recipientId,
            sender,
            event,
            threadRootMessageIndex,
            communityRulesAccepted,
            channelRulesAccepted,
            messageFilterFailed,
            pin,
        )
            .then(setCachedMessageFromSendResponse(this.db, id, event, threadRootMessageIndex))
            .catch((err) => {
                recordFailedMessage(this.db, id, event);
                throw err;
            });
    }

    private sendMessageWithTransferToChannelToBackend(
        id: ChannelIdentifier,
        recipientId: string | undefined,
        sender: CreatedUser,
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        communityRulesAccepted: number | undefined,
        channelRulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        pin: string | undefined,
    ): Promise<[SendMessageResponse, Message]> {
        const content = apiMessageContent(event.event.content);

        const req = {
            thread_root_message_index: threadRootMessageIndex,
            content,
            sender_name: sender.username,
            sender_display_name: sender.displayName,
            mentioned: [],
            message_id: event.event.messageId,
            community_id: principalStringToBytes(id.communityId),
            channel_id: toBigInt32(id.channelId),
            replies_to: mapOptional(event.event.repliesTo, (replyContext) =>
                apiReplyContextArgs(id, replyContext),
            ),
            block_level_markdown: true,
            community_rules_accepted: communityRulesAccepted,
            channel_rules_accepted: channelRulesAccepted,
            message_filter_failed: messageFilterFailed,
            pin,
        };
        return this.executeMsgpackUpdate(
            "send_message_with_transfer_to_channel",
            req,
            (resp) =>
                sendMessageWithTransferToChannelResponse(resp, event.event.sender, recipientId),
            UserSendMessageWithTransferToChannelArgs,
            UserSendMessageWithTransferToChannelResponse,
        ).then((resp) => [resp, event.event]);
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.executeMsgpackUpdate(
            "block_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            UserBlockUserArgs,
            UnitResult,
        );
    }

    unblockUser(userId: string): Promise<UnblockUserResponse> {
        return this.executeMsgpackUpdate(
            "unblock_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            UserUnblockUserArgs,
            UnitResult,
        );
    }

    leaveGroup(chatId: string): Promise<LeaveGroupResponse> {
        return this.executeMsgpackUpdate(
            "leave_group",
            {
                chat_id: principalStringToBytes(chatId),
            },
            unitResult,
            UserLeaveGroupArgs,
            UnitResult,
        );
    }

    leaveCommunity(id: CommunityIdentifier): Promise<LeaveCommunityResponse> {
        return this.executeMsgpackUpdate(
            "leave_community",
            {
                community_id: principalStringToBytes(id.communityId),
            },
            unitResult,
            UserLeaveCommunityArgs,
            UnitResult,
        );
    }

    private markMessageArg(
        chatId: string,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined,
    ) {
        return {
            chat_id: principalStringToBytes(chatId),
            read_up_to: readUpTo,
            threads: threads.map((t) => ({
                root_message_index: t.threadRootMessageIndex,
                read_up_to: t.readUpTo,
            })),
            date_read_pinned: dateReadPinned,
        };
    }

    private markChannelMessageArg(
        channelId: number,
        readUpTo: number | undefined,
        threads: ThreadRead[],
        dateReadPinned: bigint | undefined,
    ) {
        return {
            channel_id: toBigInt32(channelId),
            read_up_to: readUpTo,
            threads: threads.map((t) => ({
                root_message_index: t.threadRootMessageIndex,
                read_up_to: t.readUpTo,
            })),
            date_read_pinned: dateReadPinned,
        };
    }

    private markMessageArgs(req: MarkReadRequest): UserMarkReadArgs {
        const community: Record<string, UserMarkReadChannelMessagesRead[]> = {};
        const chat: UserMarkReadChatMessagesRead[] = [];

        req.forEach(({ chatId, readUpTo, threads, dateReadPinned }) => {
            if (chatId.kind === "direct_chat") {
                chat.push(this.markMessageArg(chatId.userId, readUpTo, threads, dateReadPinned));
            }
            if (chatId.kind === "group_chat") {
                chat.push(this.markMessageArg(chatId.groupId, readUpTo, threads, dateReadPinned));
            }
            if (chatId.kind === "channel") {
                if (community[chatId.communityId] === undefined) {
                    community[chatId.communityId] = [];
                }
                community[chatId.communityId].push(
                    this.markChannelMessageArg(chatId.channelId, readUpTo, threads, dateReadPinned),
                );
            }
        });

        return {
            messages_read: chat,
            community_messages_read: Object.entries(community).map(([communityId, read]) => ({
                community_id: principalStringToBytes(communityId),
                channels_read: read,
            })),
        };
    }

    markMessagesRead(request: MarkReadRequest): Promise<MarkReadResponse> {
        return this.executeMsgpackUpdate(
            "mark_read",
            this.markMessageArgs(request),
            (_) => "success",
            UserMarkReadArgs,
            UserMarkReadResponse,
        );
    }

    tipMessage(
        messageContext: MessageContext,
        messageId: bigint,
        transfer: PendingCryptocurrencyTransfer,
        decimals: number,
        pin: string | undefined,
    ): Promise<TipMessageResponse> {
        return this.executeMsgpackUpdate(
            "tip_message",
            {
                chat: apiChatIdentifier(messageContext.chatId),
                message_id: messageId,
                fee: transfer.feeE8s ?? 0n,
                decimals,
                token_symbol: transfer.token,
                recipient: principalStringToBytes(transfer.recipient),
                ledger: principalStringToBytes(transfer.ledger),
                amount: transfer.amountE8s,
                thread_root_message_index: messageContext.threadRootMessageIndex,
                pin,
            },
            tipMessageResponse,
            UserTipMessageArgs,
            UserTipMessageResponse,
        );
    }

    addReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex: number | undefined,
    ): Promise<AddRemoveReactionResponse> {
        return this.executeMsgpackUpdate(
            "add_reaction",
            {
                user_id: principalStringToBytes(otherUserId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
            },
            unitResult,
            UserAddReactionArgs,
            UnitResult,
        );
    }

    removeReaction(
        otherUserId: string,
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.executeMsgpackUpdate(
            "remove_reaction",
            {
                user_id: principalStringToBytes(otherUserId),
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
            },
            unitResult,
            UserRemoveReactionArgs,
            UnitResult,
        );
    }

    deleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "delete_messages",
            {
                user_id: principalStringToBytes(otherUserId),
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
            },
            unitResult,
            UserDeleteMessagesArgs,
            UnitResult,
        );
    }

    undeleteMessage(
        otherUserId: string,
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "undelete_messages",
            {
                user_id: principalStringToBytes(otherUserId),
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
            },
            (resp) => mapResult(resp, undeleteMessageSuccess),
            UserUndeleteMessagesArgs,
            UserUndeleteMessagesResponse,
        );
    }

    searchDirectChat(
        chatId: DirectChatIdentifier,
        searchTerm: string,
        maxResults: number,
    ): Promise<SearchDirectChatResponse> {
        const args = {
            user_id: principalStringToBytes(chatId.userId),
            search_term: searchTerm,
            max_results: maxResults,
        };
        return this.executeMsgpackQuery(
            "search_messages",
            args,
            (resp) => mapResult(resp, (value) => searchDirectChatSuccess(value, chatId)),
            UserSearchMessagesArgs,
            UserSearchMessagesResponse,
        );
    }

    toggleMuteNotifications(
        chatId: string,
        muted: boolean,
    ): Promise<ToggleMuteNotificationResponse> {
        const args = {
            chat_id: principalStringToBytes(chatId),
        };
        return this.executeMsgpackUpdate(
            muted ? "mute_notifications" : "unmute_notifications",
            args,
            unitResult,
            UserMuteNotificationsArgs,
            UnitResult,
        );
    }

    dismissRecommendation(chatId: string): Promise<void> {
        return this.executeMsgpackUpdate(
            "add_hot_group_exclusions",
            {
                duration: undefined,
                groups: [principalStringToBytes(chatId)],
            },
            toVoid,
            UserAddHotGroupExclusionsArgs,
            UserAddHotGroupExclusionsResponse,
        );
    }

    getBio(): Promise<string> {
        return this.executeMsgpackQuery(
            "bio",
            {},
            (value) => value.Success,
            TEmpty,
            UserBioResponse,
        );
    }

    getPublicProfile(): Promise<PublicProfile> {
        return this.executeMsgpackQuery(
            "public_profile",
            {},
            publicProfileResponse,
            TEmpty,
            UserPublicProfileResponse,
        );
    }

    setBio(bio: string): Promise<SetBioResponse> {
        return this.executeMsgpackUpdate(
            "set_bio",
            { text: bio },
            unitResult,
            UserSetBioArgs,
            UnitResult,
        );
    }

    withdrawCryptocurrency(
        domain: PendingCryptocurrencyWithdrawal,
        pin: string | undefined,
    ): Promise<WithdrawCryptocurrencyResponse> {
        const req = apiPendingCryptocurrencyWithdrawal(domain, pin);
        return this.executeMsgpackUpdate(
            "withdraw_crypto_v2",
            req,
            withdrawCryptoResponse,
            UserWithdrawCryptoArgs,
            UserWithdrawCryptoResponse,
        );
    }

    private toChatInList(chatId: ChatIdentifier, favourite: boolean): UserChatInList {
        if (favourite) {
            return {
                Favourite: apiChatIdentifier(chatId),
            };
        } else {
            switch (chatId.kind) {
                case "group_chat":
                    return { Group: principalStringToBytes(chatId.groupId) };
                case "direct_chat":
                    return { Direct: principalStringToBytes(chatId.userId) };
                case "channel":
                    return {
                        Community: [
                            principalStringToBytes(chatId.communityId),
                            toBigInt32(chatId.channelId),
                        ],
                    };
            }
        }
    }

    pinChat(chatId: ChatIdentifier, favourite: boolean): Promise<PinChatResponse> {
        return this.executeMsgpackUpdate(
            "pin_chat_v2",
            {
                chat: this.toChatInList(chatId, favourite),
            },
            unitResult,
            UserPinChatArgs,
            UnitResult,
        );
    }

    unpinChat(chatId: ChatIdentifier, favourite: boolean): Promise<UnpinChatResponse> {
        return this.executeMsgpackUpdate(
            "unpin_chat_v2",
            {
                chat: this.toChatInList(chatId, favourite),
            },
            unitResult,
            UserUnpinChatArgs,
            UnitResult,
        );
    }

    archiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        return this.executeMsgpackUpdate(
            "archive_unarchive_chats",
            {
                to_archive: [apiChatIdentifier(chatId)],
                to_unarchive: [],
            },
            archiveChatResponse,
            UserArchiveUnarchiveChatsArgs,
            UserArchiveUnarchiveChatsResponse,
        );
    }

    unarchiveChat(chatId: ChatIdentifier): Promise<ArchiveChatResponse> {
        return this.executeMsgpackUpdate(
            "archive_unarchive_chats",
            {
                to_archive: [],
                to_unarchive: [apiChatIdentifier(chatId)],
            },
            archiveChatResponse,
            UserArchiveUnarchiveChatsArgs,
            UserArchiveUnarchiveChatsResponse,
        );
    }

    getDeletedMessage(userId: string, messageId: bigint): Promise<DeletedDirectMessageResponse> {
        return this.executeMsgpackQuery(
            "deleted_message",
            {
                user_id: principalStringToBytes(userId),
                message_id: messageId,
            },
            (resp) => mapResult(resp, deletedMessageSuccess),
            UserDeletedMessageArgs,
            UserDeletedMessageResponse,
        );
    }

    setMessageReminder(
        chatId: ChatIdentifier,
        eventIndex: number,
        remindAt: number,
        notes?: string,
        threadRootMessageIndex?: number,
    ): Promise<SetMessageReminderResponse> {
        return this.executeMsgpackUpdate(
            "set_message_reminder_v2",
            {
                chat: apiChatIdentifier(chatId),
                notes,
                remind_at: BigInt(remindAt),
                thread_root_message_index: threadRootMessageIndex,
                event_index: eventIndex,
            },
            unitResult,
            UserSetMessageReminderArgs,
            UserSetMessageReminderResponse,
        );
    }

    cancelMessageReminder(reminderId: bigint): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "cancel_message_reminder",
            {
                reminder_id: reminderId,
            },
            (_) => true,
            UserCancelMessageReminderArgs,
            UserCancelMessageReminderResponse,
        );
    }

    setCommunityIndexes(communityIndexes: Record<string, number>): Promise<boolean> {
        const indexes: [Uint8Array, number][] = Object.entries(communityIndexes).map(
            ([id, idx]) => [principalStringToBytes(id), idx],
        );
        return this.executeMsgpackUpdate(
            "set_community_indexes",
            { indexes },
            (_) => true,
            UserSetCommunityIndexesArgs,
            UserSetCommunityIndexesResponse,
        );
    }

    reportMessage(
        chatId: DirectChatIdentifier,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "report_message",
            {
                them: principalStringToBytes(chatId.userId),
                message_id: messageId,
                delete: deleteMessage,
                thread_root_message_index: threadRootMessageIndex,
            },
            isSuccess,
            UserReportMessageArgs,
            UnitResult,
        );
    }

    swapTokens(
        swapId: bigint,
        inputToken: CryptocurrencyDetails,
        outputToken: CryptocurrencyDetails,
        amountIn: bigint,
        minAmountOut: bigint,
        exchangeArgs: ExchangeTokenSwapArgs,
        pin: string | undefined,
    ): Promise<SwapTokensResponse> {
        return this.executeMsgpackUpdate(
            "swap_tokens",
            {
                swap_id: swapId,
                input_token: {
                    symbol: inputToken.symbol,
                    ledger: principalStringToBytes(inputToken.ledger),
                    decimals: inputToken.decimals,
                    fee: inputToken.transferFee,
                },
                output_token: {
                    symbol: outputToken.symbol,
                    ledger: principalStringToBytes(outputToken.ledger),
                    decimals: outputToken.decimals,
                    fee: outputToken.transferFee,
                },
                input_amount: amountIn,
                exchange_args: apiExchangeArgs(exchangeArgs),
                min_output_amount: minAmountOut,
                pin,
            },
            (resp) => mapResult(resp, swapTokensSuccess),
            UserSwapTokensArgs,
            UserSwapTokensResponse,
        );
    }

    tokenSwapStatus(swapId: bigint): Promise<TokenSwapStatusResponse> {
        const args = {
            swap_id: swapId,
        };
        return this.executeMsgpackQuery(
            "token_swap_status",
            args,
            tokenSwapStatusResponse,
            UserTokenSwapStatusArgs,
            UserTokenSwapStatusResponse,
        );
    }

    approveTransfer(
        spender: string,
        ledger: string,
        amount: bigint,
        expiresIn: bigint | undefined,
        pin: string | undefined,
    ): Promise<ApproveTransferResponse> {
        return this.executeMsgpackUpdate(
            "approve_transfer",
            {
                spender: {
                    owner: principalStringToBytes(spender),
                    subaccount: undefined,
                },
                ledger_canister_id: principalStringToBytes(ledger),
                amount,
                expires_in: expiresIn,
                pin,
            },
            unitResult,
            UserApproveTransferArgs,
            UnitResult,
        );
    }

    deleteDirectChat(userId: string, blockUser: boolean): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "delete_direct_chat",
            {
                user_id: principalStringToBytes(userId),
                block_user: blockUser,
            },
            (resp) => resp === "Success",
            UserDeleteDirectChatArgs,
            UnitResult,
        );
    }

    acceptP2PSwap(
        userId: string,
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
    ): Promise<AcceptP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "accept_p2p_swap",
            {
                user_id: principalStringToBytes(userId),
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
                pin,
            },
            (resp) => mapResult(resp, acceptP2PSwapSuccess),
            UserAcceptP2pSwapArgs,
            UserAcceptP2pSwapResponse,
        );
    }

    cancelP2PSwap(userId: string, messageId: bigint): Promise<CancelP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "cancel_p2p_swap",
            {
                user_id: principalStringToBytes(userId),
                message_id: messageId,
            },
            unitResult,
            UserCancelP2pSwapArgs,
            UnitResult,
        );
    }

    joinVideoCall(userId: string, messageId: bigint): Promise<JoinVideoCallResponse> {
        return this.executeMsgpackUpdate(
            "join_video_call",
            {
                user_id: principalStringToBytes(userId),
                message_id: messageId,
            },
            unitResult,
            UserJoinVideoCallArgs,
            UnitResult,
        );
    }

    localUserIndex(): Promise<string> {
        return this.executeMsgpackQuery(
            "local_user_index",
            {},
            (resp) => principalBytesToString(resp.Success),
            TEmpty,
            UserLocalUserIndexResponse,
        );
    }

    setPinNumber(
        verification: Verification,
        newPin: string | undefined,
    ): Promise<SetPinNumberResponse> {
        return this.executeMsgpackUpdate(
            "set_pin_number",
            {
                verification: apiVerification(verification),
                new: newPin,
            },
            unitResult,
            UserSetPinNumberArgs,
            UnitResult,
        );
    }

    chitEvents({ from, to, max, ascending }: ChitEventsRequest): Promise<ChitEventsResponse> {
        return this.executeMsgpackQuery(
            "chit_events",
            {
                from,
                to,
                max,
                ascending,
                skip: undefined,
            },
            chitEventsResponse,
            UserChitEventsArgs,
            UserChitEventsResponse,
        );
    }

    markAchievementsSeen(lastSeen: bigint): Promise<void> {
        return this.executeMsgpackUpdate(
            "mark_achievements_seen",
            {
                last_seen: lastSeen,
            },
            (res) => {
                console.log("Set Achievements Last seen", lastSeen, res);
            },
            UserMarkAchievementsSeenArgs,
            UserMarkAchievementsSeenResponse,
        );
    }

    claimDailyChit(utcOffsetMins: number | undefined): Promise<ClaimDailyChitResponse> {
        return this.executeMsgpackUpdate(
            "claim_daily_chit",
            {
                utc_offset_mins: mapOptional(utcOffsetMins, identity),
            },
            claimDailyChitResponse,
            UserClaimDailyChitArgs,
            UserClaimDailyChitResponse,
        ).then((res) => {
            if (res.kind === "success") {
                // Note this only updates the users db, the chats db will be updated by the updates loop
                setChitInfoInCache(this.userId, res.chitBalance, res.streak);
            }
            return res;
        });
    }

    configureWallet(walletConfig: WalletConfig): Promise<void> {
        return this.executeMsgpackUpdate(
            "configure_wallet",
            {
                config: apiWalletConfig(walletConfig),
            },
            toVoid,
            UserConfigureWalletArgs,
            UserConfigureWalletResponse,
        );
    }

    markActivityFeedRead(readUpTo: bigint): Promise<void> {
        return this.executeMsgpackUpdate(
            "mark_message_activity_feed_read",
            { read_up_to: readUpTo },
            toVoid,
            UserMarkMessageActivityFeedReadArgs,
            UserMarkMessageActivityFeedReadResponse,
        );
    }

    messageActivityFeed(since: bigint): Promise<MessageActivityFeedResponse> {
        return this.executeMsgpackQuery(
            "message_activity_feed",
            { since },
            messageActivityFeedResponse,
            UserMessageActivityFeedArgs,
            UserMessageActivityFeedResponse,
        );
    }

    updateInstalledBot(botId: string, grantedPermissions: GrantedBotPermissions): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "update_bot",
            {
                bot_id: principalStringToBytes(botId),
                granted_permissions: apiExternalBotPermissions(grantedPermissions.command),
                granted_autonomous_permissions: mapOptional(
                    grantedPermissions.autonomous,
                    apiExternalBotPermissions,
                ),
            },
            isSuccess,
            UserUpdateBotArgs,
            UnitResult,
        );
    }

    generateBtcAddress(): Promise<string> {
        return this.executeMsgpackUpdate(
            "generate_btc_address",
            {},
            (resp) => {
                if ("Success" in resp) {
                    return resp.Success;
                } else {
                    throw new Error(`Failed to generate btc address: ${resp}`);
                }
            },
            TEmpty,
            UserGenerateBtcAddressResponse,
        );
    }

    updateBtcBalance(): Promise<boolean> {
        return this.executeMsgpackUpdate("update_btc_balance", {}, isSuccess, TEmpty, UnitResult);
    }

    withdrawBtc(
        address: string,
        amount: bigint,
        pin: string | undefined,
    ): Promise<WithdrawBtcResponse> {
        return this.executeMsgpackUpdate(
            "withdraw_btc",
            {
                address,
                amount,
                pin,
            },
            unitResult,
            UserWithdrawBtcArgs,
            UserWithdrawBtcResponse,
        );
    }

    payForStreakInsurance(
        additionalDays: number,
        expectedPrice: bigint,
        pin: string | undefined,
    ): Promise<PayForStreakInsuranceResponse> {
        return this.executeMsgpackUpdate(
            "pay_for_streak_insurance",
            {
                additional_days: additionalDays,
                expected_price: expectedPrice,
                pin,
            },
            unitResult,
            UserPayForStreakInsuranceArgs,
            UnitResult,
        );
    }

    updateChatSettings(userId: string, eventsTtl: OptionUpdate<bigint>): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "update_chat_settings",
            {
                user_id: principalStringToBytes(userId),
                events_ttl: apiOptionUpdateV2(identity, eventsTtl),
            },
            isSuccess,
            UserUpdateChatSettingsArgs,
            UnitResult,
        )
    }
}
