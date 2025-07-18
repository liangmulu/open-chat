import type { HttpAgent, Identity } from "@dfinity/agent";
import type {
    AcceptP2PSwapResponse,
    AccessGateConfig,
    AddRemoveReactionResponse,
    BlockUserResponse,
    CancelP2PSwapResponse,
    ChangeRoleResponse,
    ChatEvent,
    ClaimPrizeResponse,
    ConvertToCommunityResponse,
    DeclineInvitationResponse,
    DeletedGroupMessageResponse,
    DeleteMessageResponse,
    DisableInviteCodeResponse,
    EditMessageResponse,
    EnableInviteCodeResponse,
    EventsResponse,
    EventsSuccessResult,
    EventWrapper,
    FollowThreadResponse,
    FullWebhookDetails,
    GrantedBotPermissions,
    GroupCanisterSummaryResponse,
    GroupCanisterSummaryUpdatesResponse,
    GroupChatDetails,
    GroupChatDetailsResponse,
    GroupChatIdentifier,
    IndexRange,
    InviteCodeResponse,
    JoinVideoCallResponse,
    MemberRole,
    Message,
    OCError,
    OptionalChatPermissions,
    OptionUpdate,
    PinMessageResponse,
    PublicGroupSummaryResponse,
    RegisterPollVoteResponse,
    RegisterProposalVoteResponse,
    RemoveMemberResponse,
    ResetInviteCodeResponse,
    Rules,
    SearchGroupChatResponse,
    SendMessageResponse,
    SetVideoCallPresenceResponse,
    Tally,
    ThreadPreviewsResponse,
    ToggleMuteNotificationResponse,
    UnblockUserResponse,
    UndeleteMessageResponse,
    UnpinMessageResponse,
    UpdatedRules,
    UpdateGroupResponse,
    User,
    VideoCallParticipantsResponse,
    VideoCallPresence,
} from "openchat-shared";
import {
    DestinationInvalidError,
    isSuccessfulEventsResponse,
    MAX_EVENTS,
    MAX_MESSAGES,
    MAX_MISSING,
    offline,
    ResponseTooLargeError,
    textToCode,
} from "openchat-shared";
import type { AgentConfig } from "../../config";
import {
    ActiveProposalTalliesResponse,
    GroupAcceptP2pSwapArgs,
    GroupAcceptP2pSwapResponse,
    GroupActiveProposalTalliesArgs,
    GroupAddReactionArgs,
    GroupBlockUserArgs,
    GroupCancelInvitesArgs,
    GroupCancelP2pSwapArgs,
    GroupChangeRoleArgs,
    GroupClaimPrizeArgs,
    GroupClaimPrizeResponse,
    GroupConvertIntoCommunityArgs,
    GroupConvertIntoCommunityResponse,
    GroupDeletedMessageArgs,
    GroupDeletedMessageResponse,
    GroupDeleteMessagesArgs,
    GroupDeleteWebhookArgs,
    GroupEditMessageArgs,
    GroupEnableInviteCodeResponse,
    GroupEventsArgs,
    GroupEventsByIndexArgs,
    GroupEventsResponse,
    GroupEventsWindowArgs,
    GroupFollowThreadArgs,
    GroupInviteCodeResponse,
    GroupJoinVideoCallArgs,
    GroupLocalUserIndexResponse,
    GroupMessagesByMessageIndexArgs,
    GroupMessagesByMessageIndexResponse,
    GroupPinMessageArgs,
    GroupPinMessageResponse,
    GroupPublicSummaryArgs,
    GroupPublicSummaryResponse,
    GroupRegenerateWebhookArgs,
    GroupRegenerateWebhookResponse,
    GroupRegisterPollVoteArgs,
    GroupRegisterPollVoteResponse,
    GroupRegisterProposalVoteArgs,
    GroupRegisterProposalVoteV2Args,
    GroupRegisterWebhookArgs,
    GroupRegisterWebhookResponse,
    GroupRemoveParticipantArgs,
    GroupRemoveReactionArgs,
    GroupReportMessageArgs,
    GroupSearchMessagesArgs,
    GroupSearchMessagesResponse,
    GroupSelectedInitialResponse,
    GroupSelectedUpdatesArgs,
    GroupSelectedUpdatesResponse,
    GroupSendMessageArgs,
    GroupSendMessageResponse,
    GroupSetVideoCallPresenceArgs,
    GroupSummaryResponse,
    GroupSummaryUpdatesArgs,
    GroupSummaryUpdatesResponse,
    GroupThreadPreviewsArgs,
    GroupThreadPreviewsResponse,
    GroupToggleMuteNotificationsArgs,
    GroupUnblockUserArgs,
    GroupUndeleteMessagesArgs,
    GroupUndeleteMessagesResponse,
    GroupUnpinMessageArgs,
    GroupUnpinMessageResponse,
    GroupUpdateBotArgs,
    GroupUpdateGroupArgs,
    GroupUpdateGroupResponse,
    GroupUpdateWebhookArgs,
    GroupVideoCallParticipantsArgs,
    GroupVideoCallParticipantsResponse,
    GroupWebhookArgs,
    GroupWebhookResponse,
    Empty as TEmpty,
    UnitResult,
} from "../../typebox";
import {
    type Database,
    getCachedEvents,
    getCachedEventsByIndex,
    getCachedEventsWindowByMessageIndex,
    getCachedGroupDetails,
    loadMessagesByMessageIndex,
    mergeSuccessResponses,
    recordFailedMessage,
    removeFailedMessage,
    setCachedEvents,
    setCachedGroupDetails,
    setCachedMessageFromSendResponse,
} from "../../utils/caching";
import { mergeGroupChatDetails } from "../../utils/chat";
import {
    apiOptionUpdateV2,
    identity,
    mapOptional,
    principalBytesToString,
    principalStringToBytes,
} from "../../utils/mapping";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
import {
    acceptP2PSwapSuccess,
    apiAccessGateConfig,
    apiExternalBotPermissions,
    apiMessageContent,
    apiUser as apiUserV2,
    apiVideoCallPresence,
    claimPrizeResponse,
    deletedMessageSuccess,
    enableOrResetInviteCodeSuccess,
    getEventsSuccess,
    getMessagesSuccess,
    groupDetailsSuccess,
    groupDetailsUpdatesResponse,
    inviteCodeSuccess,
    isSuccess,
    mapResult,
    proposalTallies,
    pushEventSuccess,
    searchGroupChatResponse,
    sendMessageSuccess,
    threadPreviewsSuccess,
    undeleteMessageSuccess,
    unitResult,
    updateGroupSuccess,
    videoCallParticipantsSuccess,
    webhookDetails,
} from "../common/chatMappersV2";
import {
    chunkedChatEventsFromBackend,
    chunkedChatEventsWindowFromBackend,
} from "../common/chunked";
import { publicSummarySuccess } from "../common/publicSummaryMapperV2";
import { DataClient } from "../data/data.client";
import {
    apiOptionalGroupPermissions,
    apiRole,
    apiUpdatedRules,
    convertToCommunitySuccess,
    groupChatSummary,
    summaryUpdatesResponse,
} from "./mappersV2";

export class GroupClient extends MsgpackCanisterAgent {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        private config: AgentConfig,
        private chatId: GroupChatIdentifier,
        private db: Database,
        private inviteCode: string | undefined,
    ) {
        super(identity, agent, chatId.groupId, "Group");
    }

    summary(): Promise<GroupCanisterSummaryResponse> {
        return this.executeMsgpackQuery(
            "summary",
            {},
            (resp) => mapResult(resp, (value) => groupChatSummary(value.summary)),
            TEmpty,
            GroupSummaryResponse,
        ).catch((err) => {
            if (err instanceof DestinationInvalidError) {
                return { kind: "canister_not_found" };
            } else {
                throw err;
            }
        });
    }

    summaryUpdates(updatesSince: bigint): Promise<GroupCanisterSummaryUpdatesResponse> {
        const args = { updates_since: updatesSince };

        return this.executeMsgpackQuery(
            "summary_updates",
            args,
            summaryUpdatesResponse,
            GroupSummaryUpdatesArgs,
            GroupSummaryUpdatesResponse,
        );
    }

    getCachedEventsByIndex(eventIndexes: number[], threadRootMessageIndex: number | undefined) {
        return getCachedEventsByIndex(this.db, eventIndexes, {
            chatId: this.chatId,
            threadRootMessageIndex,
        });
    }

    chatEventsByIndex(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        return this.getCachedEventsByIndex(eventIndexes, threadRootMessageIndex).then((res) =>
            this.handleMissingEvents(res, threadRootMessageIndex, latestKnownUpdate),
        );
    }

    private setCachedEvents<T extends ChatEvent>(
        resp: EventsResponse<T>,
        threadRootMessageIndex?: number,
    ): EventsResponse<T> {
        setCachedEvents(this.db, this.chatId, resp, threadRootMessageIndex).catch((err) =>
            this.config.logger.error("Error writing cached group events", err),
        );
        return resp;
    }

    private handleMissingEvents(
        [cachedEvents, missing]: [EventsSuccessResult<ChatEvent>, Set<number>],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        if (missing.size === 0) {
            return Promise.resolve(cachedEvents);
        } else {
            return this.chatEventsByIndexFromBackend(
                [...missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .then((resp) => {
                    if (isSuccessfulEventsResponse(resp)) {
                        return mergeSuccessResponses(cachedEvents, resp);
                    }
                    return resp;
                });
        }
    }

    chatEventsByIndexFromBackend(
        eventIndexes: number[],
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            events: eventIndexes,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events_by_index",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            GroupEventsByIndexArgs,
            GroupEventsResponse,
        );
    }

    async chatEventsWindow(
        eventIndexRange: IndexRange,
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing, totalMiss] = await getCachedEventsWindowByMessageIndex(
            this.db,
            eventIndexRange,
            { chatId: this.chatId, threadRootMessageIndex },
            messageIndex,
            maxEvents,
        );

        if (totalMiss || missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log(
                "We didn't get enough back from the cache, going to the api",
                missing.size,
                totalMiss,
            );
            return this.chatEventsWindowFromBackend(
                messageIndex,
                threadRootMessageIndex,
                latestKnownUpdate,
                maxEvents,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the window request into a a few chunks",
                        );
                        return chunkedChatEventsWindowFromBackend(
                            (index: number, ascending: boolean, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            (index: number, chunkSize: number) =>
                                this.chatEventsWindowFromBackend(
                                    index,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            messageIndex,
                        ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private async chatEventsWindowFromBackend(
        messageIndex: number,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            mid_point: messageIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events_window",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            GroupEventsWindowArgs,
            GroupEventsResponse,
        );
    }

    async chatEvents(
        eventIndexRange: IndexRange,
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<ChatEvent>> {
        const [cachedEvents, missing] = await getCachedEvents(
            this.db,
            eventIndexRange,
            { chatId: this.chatId, threadRootMessageIndex },
            startIndex,
            ascending,
        );

        // we may or may not have all of the requested events
        if (missing.size >= MAX_MISSING) {
            // if we have exceeded the maximum number of missing events, let's just consider it a complete miss and go to the api
            console.log("We didn't get enough back from the cache, going to the api", missing.size);
            return this.chatEventsFromBackend(
                startIndex,
                ascending,
                threadRootMessageIndex,
                latestKnownUpdate,
            )
                .then((resp) => this.setCachedEvents(resp, threadRootMessageIndex))
                .catch((err) => {
                    if (err instanceof ResponseTooLargeError) {
                        console.log(
                            "Response size too large, we will try to split the payload into a a few chunks",
                        );
                        return chunkedChatEventsFromBackend(
                            (index: number, chunkSize: number) =>
                                this.chatEventsFromBackend(
                                    index,
                                    ascending,
                                    threadRootMessageIndex,
                                    latestKnownUpdate,
                                    chunkSize,
                                ),
                            eventIndexRange,
                            startIndex,
                            ascending,
                        ).then((resp) => this.setCachedEvents(resp, threadRootMessageIndex));
                    } else {
                        throw err;
                    }
                });
        } else {
            return this.handleMissingEvents(
                [cachedEvents, missing],
                threadRootMessageIndex,
                latestKnownUpdate,
            );
        }
    }

    private chatEventsFromBackend(
        startIndex: number,
        ascending: boolean,
        threadRootMessageIndex: number | undefined,
        latestKnownUpdate: bigint | undefined,
        maxEvents: number = MAX_EVENTS,
    ): Promise<EventsResponse<ChatEvent>> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            max_messages: MAX_MESSAGES,
            max_events: maxEvents,
            ascending,
            start_index: startIndex,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "events",
            args,
            (resp) =>
                mapResult(resp, (value) => getEventsSuccess(value, this.principal, this.chatId)),
            GroupEventsArgs,
            GroupEventsResponse,
        );
    }

    changeRole(userId: string, newRole: MemberRole): Promise<ChangeRoleResponse> {
        const new_role = apiRole(newRole);
        if (new_role === undefined) {
            throw new Error(`Cannot change user's role to: ${newRole}`);
        }
        return this.executeMsgpackUpdate(
            "change_role",
            {
                user_id: principalStringToBytes(userId),
                new_role,
            },
            unitResult,
            GroupChangeRoleArgs,
            UnitResult,
        );
    }

    removeMember(userId: string): Promise<RemoveMemberResponse> {
        return this.executeMsgpackUpdate(
            "remove_participant",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            GroupRemoveParticipantArgs,
            UnitResult,
        );
    }

    editMessage(
        message: Message,
        threadRootMessageIndex: number | undefined,
        blockLevelMarkdown: boolean | undefined,
        newAchievement: boolean,
    ): Promise<EditMessageResponse> {
        return new DataClient(this.identity, this.agent, this.config)
            .uploadData(message.content, [this.chatId.groupId])
            .then((content) => {
                const args = {
                    thread_root_message_index: threadRootMessageIndex,
                    content: apiMessageContent(content ?? message.content),
                    message_id: message.messageId,
                    block_level_markdown: blockLevelMarkdown,
                    new_achievement: newAchievement,
                };
                return this.executeMsgpackUpdate(
                    "edit_message_v2",
                    args,
                    unitResult,
                    GroupEditMessageArgs,
                    UnitResult,
                );
            });
    }

    claimPrize(messageId: bigint): Promise<ClaimPrizeResponse> {
        return this.executeMsgpackUpdate(
            "claim_prize",
            {
                message_id: messageId,
            },
            claimPrizeResponse,
            GroupClaimPrizeArgs,
            GroupClaimPrizeResponse,
        );
    }

    sendMessage(
        senderName: string,
        senderDisplayName: string | undefined,
        mentioned: User[],
        event: EventWrapper<Message>,
        threadRootMessageIndex: number | undefined,
        rulesAccepted: number | undefined,
        messageFilterFailed: bigint | undefined,
        newAchievement: boolean,
        onRequestAccepted: () => void,
    ): Promise<[SendMessageResponse, Message]> {
        // pre-emtively remove the failed message from indexeddb - it will get re-added if anything goes wrong
        removeFailedMessage(this.db, this.chatId, event.event.messageId, threadRootMessageIndex);

        const dataClient = new DataClient(this.identity, this.agent, this.config);
        const uploadContentPromise = event.event.forwarded
            ? dataClient.forwardData(event.event.content, [this.chatId.groupId])
            : dataClient.uploadData(event.event.content, [this.chatId.groupId]);

        return uploadContentPromise.then((content) => {
            const newEvent =
                content !== undefined ? { ...event, event: { ...event.event, content } } : event;
            const args = {
                content: apiMessageContent(newEvent.event.content),
                message_id: newEvent.event.messageId,
                sender_name: senderName,
                sender_display_name: senderDisplayName,
                rules_accepted: rulesAccepted,
                replies_to: mapOptional(newEvent.event.repliesTo, (replyContext) => ({
                    event_index: replyContext.eventIndex,
                })),
                mentioned: mentioned.map(apiUserV2),
                forwarding: newEvent.event.forwarded,
                thread_root_message_index: threadRootMessageIndex,
                message_filter_failed: messageFilterFailed,
                block_level_markdown: newEvent.event.blockLevelMarkdown,
                new_achievement: newAchievement,
            };

            return this.executeMsgpackUpdate(
                "send_message_v2",
                args,
                (resp) => mapResult(resp, sendMessageSuccess),
                GroupSendMessageArgs,
                GroupSendMessageResponse,
                onRequestAccepted,
            )
                .then((resp) => {
                    const retVal: [SendMessageResponse, Message] = [resp, newEvent.event];
                    setCachedMessageFromSendResponse(
                        this.db,
                        this.chatId,
                        newEvent,
                        threadRootMessageIndex,
                    )(retVal);
                    return retVal;
                })
                .catch((err) => {
                    recordFailedMessage(this.db, this.chatId, newEvent, threadRootMessageIndex);
                    throw err;
                });
        });
    }

    updateGroup(
        name?: string,
        description?: string,
        rules?: UpdatedRules,
        permissions?: OptionalChatPermissions,
        avatar?: Uint8Array,
        eventsTimeToLiveMs?: OptionUpdate<bigint>,
        gateConfig?: AccessGateConfig,
        isPublic?: boolean,
        messagesVisibleToNonMembers?: boolean,
    ): Promise<UpdateGroupResponse> {
        return this.executeMsgpackUpdate(
            "update_group_v2",
            {
                name,
                description,
                public: isPublic,
                avatar:
                    avatar === undefined
                        ? "NoChange"
                        : {
                              SetToSome: {
                                  id: DataClient.newBlobId(),
                                  mime_type: "image/jpg",
                                  data: avatar,
                              },
                          },
                permissions_v2: mapOptional(permissions, apiOptionalGroupPermissions),
                rules: mapOptional(rules, apiUpdatedRules),
                events_ttl: apiOptionUpdateV2(identity, eventsTimeToLiveMs),
                gate_config:
                    gateConfig === undefined
                        ? "NoChange"
                        : gateConfig.gate.kind === "no_gate"
                        ? "SetToNone"
                        : { SetToSome: apiAccessGateConfig(gateConfig) },
                messages_visible_to_non_members: messagesVisibleToNonMembers,
            },
            (resp) => mapResult(resp, updateGroupSuccess),
            GroupUpdateGroupArgs,
            GroupUpdateGroupResponse,
        );
    }

    addReaction(
        messageId: bigint,
        reaction: string,
        username: string,
        displayName: string | undefined,
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<AddRemoveReactionResponse> {
        return this.executeMsgpackUpdate(
            "add_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
                username,
                display_name: displayName,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupAddReactionArgs,
            UnitResult,
        );
    }

    removeReaction(
        messageId: bigint,
        reaction: string,
        threadRootMessageIndex?: number,
    ): Promise<AddRemoveReactionResponse> {
        return this.executeMsgpackUpdate(
            "remove_reaction",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                reaction,
            },
            unitResult,
            GroupRemoveReactionArgs,
            UnitResult,
        );
    }

    deleteMessage(
        messageId: bigint,
        threadRootMessageIndex: number | undefined,
        asPlatformModerator: boolean | undefined,
        newAchievement: boolean,
    ): Promise<DeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "delete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
                as_platform_moderator: asPlatformModerator,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupDeleteMessagesArgs,
            UnitResult,
        );
    }

    undeleteMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<UndeleteMessageResponse> {
        return this.executeMsgpackUpdate(
            "undelete_messages",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_ids: [messageId],
            },
            (resp) => mapResult(resp, undeleteMessageSuccess),
            GroupUndeleteMessagesArgs,
            GroupUndeleteMessagesResponse,
        );
    }

    blockUser(userId: string): Promise<BlockUserResponse> {
        return this.executeMsgpackUpdate(
            "block_user",
            {
                user_id: principalStringToBytes(userId),
            },
            unitResult,
            GroupBlockUserArgs,
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
            GroupUnblockUserArgs,
            UnitResult,
        );
    }

    async getGroupDetails(chatLastUpdated: bigint): Promise<GroupChatDetailsResponse> {
        const fromCache = await getCachedGroupDetails(this.db, this.chatId.groupId);
        if (fromCache !== undefined) {
            if (fromCache.timestamp >= chatLastUpdated || offline()) {
                return fromCache;
            } else {
                return this.getGroupDetailsUpdates(fromCache);
            }
        }

        const response = await this.getGroupDetailsFromBackend();
        if (typeof response === "object" && "members" in response) {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private getGroupDetailsFromBackend(): Promise<GroupChatDetailsResponse> {
        return this.executeMsgpackQuery(
            "selected_initial",
            {},
            (resp) =>
                mapResult(resp, (value) =>
                    groupDetailsSuccess(value, this.config.blobUrlPattern, this.chatId.groupId),
                ),
            TEmpty,
            GroupSelectedInitialResponse,
        );
    }

    private async getGroupDetailsUpdates(previous: GroupChatDetails): Promise<GroupChatDetails> {
        const response = await this.getGroupDetailsUpdatesFromBackend(previous);
        if (response.timestamp > previous.timestamp) {
            await setCachedGroupDetails(this.db, this.chatId.groupId, response);
        }
        return response;
    }

    private async getGroupDetailsUpdatesFromBackend(
        previous: GroupChatDetails,
    ): Promise<GroupChatDetails> {
        const args = {
            updates_since: previous.timestamp,
        };
        const updatesResponse = await this.executeMsgpackQuery(
            "selected_updates_v2",
            args,
            (value) =>
                groupDetailsUpdatesResponse(value, this.config.blobUrlPattern, this.chatId.groupId),
            GroupSelectedUpdatesArgs,
            GroupSelectedUpdatesResponse,
        );

        if (updatesResponse.kind === "failure") {
            return previous;
        }

        if (updatesResponse.kind === "success_no_updates") {
            return {
                ...previous,
                timestamp: updatesResponse.timestamp,
            };
        }

        return mergeGroupChatDetails(previous, updatesResponse);
    }

    getPublicSummary(): Promise<PublicGroupSummaryResponse> {
        const args = { invite_code: mapOptional(this.inviteCode, textToCode) };
        return this.executeMsgpackQuery(
            "public_summary",
            args,
            (resp) => mapResult(resp, publicSummarySuccess),
            GroupPublicSummaryArgs,
            GroupPublicSummaryResponse,
        );
    }

    async getMessagesByMessageIndex(
        messageIndexes: Set<number>,
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const fromCache = await loadMessagesByMessageIndex(this.db, this.chatId, messageIndexes);
        if (fromCache.missing.size > 0) {
            console.log("Missing idxs from the cached: ", fromCache.missing);

            const resp = await this.getMessagesByMessageIndexFromBackend(
                [...fromCache.missing],
                latestKnownUpdate,
            ).then((resp) => this.setCachedEvents(resp));

            return isSuccessfulEventsResponse(resp)
                ? {
                      events: [...fromCache.messageEvents, ...resp.events],
                      expiredEventRanges: [],
                      expiredMessageRanges: [],
                      latestEventIndex: resp.latestEventIndex,
                  }
                : resp;
        }
        return {
            events: fromCache.messageEvents,
            expiredEventRanges: [],
            expiredMessageRanges: [],
            latestEventIndex: undefined,
        };
    }

    private getMessagesByMessageIndexFromBackend(
        messageIndexes: number[],
        latestKnownUpdate: bigint | undefined,
    ): Promise<EventsResponse<Message>> {
        const args = {
            thread_root_message_index: undefined,
            messages: messageIndexes,
            invite_code: undefined,
            latest_known_update: latestKnownUpdate,
            latest_client_event_index: undefined,
        };
        return this.executeMsgpackQuery(
            "messages_by_message_index",
            args,
            (resp) =>
                mapResult(resp, (value) => getMessagesSuccess(value, this.principal, this.chatId)),
            GroupMessagesByMessageIndexArgs,
            GroupMessagesByMessageIndexResponse,
        );
    }

    getDeletedMessage(
        messageId: bigint,
        threadRootMessageIndex?: number,
    ): Promise<DeletedGroupMessageResponse> {
        return this.executeMsgpackUpdate(
            "deleted_message",
            {
                message_id: messageId,
                thread_root_message_index: threadRootMessageIndex,
            },
            (resp) => mapResult(resp, deletedMessageSuccess),
            GroupDeletedMessageArgs,
            GroupDeletedMessageResponse,
        );
    }

    pinMessage(messageIndex: number): Promise<PinMessageResponse> {
        return this.executeMsgpackUpdate(
            "pin_message_v2",
            {
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            GroupPinMessageArgs,
            GroupPinMessageResponse,
        );
    }

    unpinMessage(messageIndex: number): Promise<UnpinMessageResponse> {
        return this.executeMsgpackUpdate(
            "unpin_message",
            {
                message_index: messageIndex,
            },
            (resp) => mapResult(resp, pushEventSuccess),
            GroupUnpinMessageArgs,
            GroupUnpinMessageResponse,
        );
    }

    registerPollVote(
        messageIdx: number,
        answerIdx: number,
        voteType: "register" | "delete",
        threadRootMessageIndex: number | undefined,
        newAchievement: boolean,
    ): Promise<RegisterPollVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_poll_vote",
            {
                thread_root_message_index: threadRootMessageIndex,
                poll_option: answerIdx,
                operation: voteType === "register" ? "RegisterVote" : "DeleteVote",
                message_index: messageIdx,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupRegisterPollVoteArgs,
            GroupRegisterPollVoteResponse,
        );
    }

    searchGroupChat(
        searchTerm: string,
        userIds: string[],
        maxResults: number,
    ): Promise<SearchGroupChatResponse> {
        const args = {
            search_term: searchTerm,
            max_results: maxResults,
            users: userIds.map(principalStringToBytes),
        };
        return this.executeMsgpackQuery(
            "search_messages",
            args,
            (res) => searchGroupChatResponse(res, this.chatId),
            GroupSearchMessagesArgs,
            GroupSearchMessagesResponse,
        );
    }

    getInviteCode(): Promise<InviteCodeResponse> {
        return this.executeMsgpackQuery(
            "invite_code",
            {},
            (resp) => mapResult(resp, inviteCodeSuccess),
            TEmpty,
            GroupInviteCodeResponse,
        );
    }

    enableInviteCode(): Promise<EnableInviteCodeResponse> {
        return this.executeMsgpackUpdate(
            "enable_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            GroupEnableInviteCodeResponse,
        );
    }

    disableInviteCode(): Promise<DisableInviteCodeResponse> {
        return this.executeMsgpackUpdate("disable_invite_code", {}, unitResult, TEmpty, UnitResult);
    }

    resetInviteCode(): Promise<ResetInviteCodeResponse> {
        return this.executeMsgpackUpdate(
            "reset_invite_code",
            {},
            (resp) => mapResult(resp, enableOrResetInviteCodeSuccess),
            TEmpty,
            GroupEnableInviteCodeResponse,
        );
    }

    threadPreviews(
        threadRootMessageIndexes: number[],
        latestClientThreadUpdate: bigint | undefined,
    ): Promise<ThreadPreviewsResponse> {
        return this.executeMsgpackQuery(
            "thread_previews",
            {
                threads: threadRootMessageIndexes,
                latest_client_thread_update: latestClientThreadUpdate,
            },
            (resp) => mapResult(resp, (value) => threadPreviewsSuccess(value, this.chatId)),
            GroupThreadPreviewsArgs,
            GroupThreadPreviewsResponse,
        );
    }

    registerProposalVote(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_proposal_vote",
            {
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            GroupRegisterProposalVoteArgs,
            UnitResult,
        );
    }

    registerProposalVoteV2(
        messageIdx: number,
        adopt: boolean,
    ): Promise<RegisterProposalVoteResponse> {
        return this.executeMsgpackUpdate(
            "register_proposal_vote_v2",
            {
                adopt,
                message_index: messageIdx,
            },
            unitResult,
            GroupRegisterProposalVoteV2Args,
            UnitResult,
        );
    }

    localUserIndex(): Promise<string> {
        return this.executeMsgpackQuery(
            "local_user_index",
            {},
            (resp) => principalBytesToString(resp.Success),
            TEmpty,
            GroupLocalUserIndexResponse,
        );
    }

    declineInvitation(): Promise<DeclineInvitationResponse> {
        return this.executeMsgpackUpdate("decline_invitation", {}, unitResult, TEmpty, UnitResult);
    }

    toggleMuteNotifications(mute: boolean): Promise<ToggleMuteNotificationResponse> {
        return this.executeMsgpackUpdate(
            "toggle_mute_notifications",
            { mute },
            unitResult,
            GroupToggleMuteNotificationsArgs,
            UnitResult,
        );
    }

    convertToCommunity(historyVisible: boolean, rules: Rules): Promise<ConvertToCommunityResponse> {
        return this.executeMsgpackUpdate(
            "convert_into_community",
            {
                history_visible_to_new_joiners: historyVisible,
                primary_language: undefined,
                permissions: undefined,
                rules,
            },
            (resp) => mapResult(resp, convertToCommunitySuccess),
            GroupConvertIntoCommunityArgs,
            GroupConvertIntoCommunityResponse,
        );
    }

    followThread(
        threadRootMessageIndex: number,
        follow: boolean,
        newAchievement: boolean,
    ): Promise<FollowThreadResponse> {
        const args = {
            thread_root_message_index: threadRootMessageIndex,
            new_achievement: newAchievement,
        };
        return this.executeMsgpackUpdate(
            follow ? "follow_thread" : "unfollow_thread",
            args,
            unitResult,
            GroupFollowThreadArgs,
            UnitResult,
        );
    }

    reportMessage(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        deleteMessage: boolean,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "report_message",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                delete: deleteMessage,
            },
            isSuccess,
            GroupReportMessageArgs,
            UnitResult,
        );
    }

    acceptP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
        pin: string | undefined,
        newAchievement: boolean,
    ): Promise<AcceptP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "accept_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
                pin,
                new_achievement: newAchievement,
            },
            (resp) => mapResult(resp, acceptP2PSwapSuccess),
            GroupAcceptP2pSwapArgs,
            GroupAcceptP2pSwapResponse,
        );
    }

    cancelP2PSwap(
        threadRootMessageIndex: number | undefined,
        messageId: bigint,
    ): Promise<CancelP2PSwapResponse> {
        return this.executeMsgpackUpdate(
            "cancel_p2p_swap",
            {
                thread_root_message_index: threadRootMessageIndex,
                message_id: messageId,
            },
            unitResult,
            GroupCancelP2pSwapArgs,
            UnitResult,
        );
    }

    joinVideoCall(messageId: bigint, newAchievement: boolean): Promise<JoinVideoCallResponse> {
        return this.executeMsgpackUpdate(
            "join_video_call",
            {
                message_id: messageId,
                new_achievement: newAchievement,
            },
            unitResult,
            GroupJoinVideoCallArgs,
            UnitResult,
        );
    }

    setVideoCallPresence(
        messageId: bigint,
        presence: VideoCallPresence,
        newAchievement: boolean,
    ): Promise<SetVideoCallPresenceResponse> {
        return this.executeMsgpackUpdate(
            "set_video_call_presence",
            {
                message_id: messageId,
                presence: apiVideoCallPresence(presence),
                new_achievement: newAchievement,
            },
            unitResult,
            GroupSetVideoCallPresenceArgs,
            UnitResult,
        );
    }

    videoCallParticipants(
        messageId: bigint,
        updatesSince?: bigint,
    ): Promise<VideoCallParticipantsResponse> {
        return this.executeMsgpackQuery(
            "video_call_participants",
            {
                message_id: messageId,
                updated_since: updatesSince,
            },
            (resp) => mapResult(resp, videoCallParticipantsSuccess),
            GroupVideoCallParticipantsArgs,
            GroupVideoCallParticipantsResponse,
        );
    }

    cancelInvites(userIds: string[]): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "cancel_invites",
            {
                user_ids: userIds.map(principalStringToBytes),
            },
            isSuccess,
            GroupCancelInvitesArgs,
            UnitResult,
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
            GroupUpdateBotArgs,
            UnitResult,
        );
    }

    registerWebhook(
        name: string,
        avatar: string | undefined,
    ): Promise<FullWebhookDetails | undefined> {
        return this.executeMsgpackUpdate(
            "register_webhook",
            {
                name,
                avatar,
            },
            (resp) => {
                if (typeof resp === "object" && "Success" in resp) {
                    const result = webhookDetails(
                        {
                            id: resp.Success.id,
                            name,
                            avatar_id: resp.Success.avatar_id,
                        },
                        this.config.blobUrlPattern,
                        this.chatId.groupId,
                    );

                    return {
                        ...result,
                        secret: resp.Success.secret,
                    };
                }
                return undefined;
            },
            GroupRegisterWebhookArgs,
            GroupRegisterWebhookResponse,
        );
    }

    updateWebhook(
        id: string,
        name: string | undefined,
        avatar: OptionUpdate<string>,
    ): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "update_webhook",
            {
                id: principalStringToBytes(id),
                name,
                avatar: apiOptionUpdateV2(identity, avatar),
            },
            isSuccess,
            GroupUpdateWebhookArgs,
            UnitResult,
        );
    }

    regenerateWebhook(id: string): Promise<string | undefined> {
        return this.executeMsgpackUpdate(
            "regenerate_webhook",
            {
                id: principalStringToBytes(id),
            },
            (resp) => {
                return typeof resp === "object" && "Success" in resp
                    ? resp.Success.secret
                    : undefined;
            },
            GroupRegenerateWebhookArgs,
            GroupRegenerateWebhookResponse,
        );
    }

    deleteWebhook(id: string): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "delete_webhook",
            {
                id: principalStringToBytes(id),
            },
            isSuccess,
            GroupDeleteWebhookArgs,
            UnitResult,
        );
    }

    getWebhook(id: string): Promise<string | undefined> {
        return this.executeMsgpackQuery(
            "webhook",
            {
                id: principalStringToBytes(id),
            },
            (resp) => {
                if (typeof resp === "object" && "Success" in resp) {
                    return resp.Success.secret;
                }
                console.log("Failed to get group webhook: ", id, resp);
                return undefined;
            },
            GroupWebhookArgs,
            GroupWebhookResponse,
        );
    }

    activeProposalTallies(): Promise<[number, Tally][] | OCError> {
        return this.executeMsgpackQuery(
            "active_proposal_tallies",
            {
                invite_code: mapOptional(this.inviteCode, textToCode),
            },
            (resp) => mapResult(resp, (value) => proposalTallies(value.tallies)),
            GroupActiveProposalTalliesArgs,
            ActiveProposalTalliesResponse,
        )
    }
}
