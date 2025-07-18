/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { HttpAgent, Identity } from "@dfinity/agent";
import { MsgpackCanisterAgent } from "../canisterAgent/msgpack";
import { subscriptionExistsResponse } from "./mappers";
import { toVoid } from "../../utils/mapping";
import {
    NotificationsIndexPushSubscriptionArgs,
    NotificationsIndexPushSubscriptionResponse,
    NotificationsIndexRemoveSubscriptionArgs,
    NotificationsIndexRemoveSubscriptionResponse,
    NotificationsIndexSubscriptionExistsArgs,
    NotificationsIndexSubscriptionExistsResponse,
    NotificationsIndexFcmTokenExistsArgs,
    NotificationsIndexFcmTokenExistsResponse,
    NotificationsIndexAddFcmTokenArgs,
    UnitResult,
} from "../../typebox";

export class NotificationsClient extends MsgpackCanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "Notifications");
    }

    subscriptionExists(p256dh_key: string): Promise<boolean> {
        return this.executeMsgpackQuery(
            "subscription_exists",
            {
                p256dh_key,
            },
            subscriptionExistsResponse,
            NotificationsIndexSubscriptionExistsArgs,
            NotificationsIndexSubscriptionExistsResponse,
        );
    }

    pushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        const request = {
            subscription: {
                endpoint: subscription.endpoint!,
                keys: {
                    auth: subscription.keys!["auth"],
                    p256dh: subscription.keys!["p256dh"],
                },
            },
        };
        return this.executeMsgpackUpdate(
            "push_subscription",
            request,
            toVoid,
            NotificationsIndexPushSubscriptionArgs,
            NotificationsIndexPushSubscriptionResponse,
        );
    }

    removeSubscription(subscription: PushSubscriptionJSON): Promise<void> {
        return this.executeMsgpackUpdate(
            "remove_subscription",
            {
                p256dh_key: subscription.keys!["p256dh"],
            },
            toVoid,
            NotificationsIndexRemoveSubscriptionArgs,
            NotificationsIndexRemoveSubscriptionResponse,
        );
    }

    fcmTokenExists(fcmToken: string): Promise<boolean> {
        return this.executeMsgpackQuery(
            "fcm_token_exists",
            { fcm_token: fcmToken },
            (response) => response as boolean,
            NotificationsIndexFcmTokenExistsArgs,
            NotificationsIndexFcmTokenExistsResponse,
        );
    }

    addFcmToken(fcmToken: string, onResponseError?: (error: string | null) => void): Promise<void> {
        return this.executeMsgpackUpdate(
            "add_fcm_token",
            { fcm_token: fcmToken },
            (response) => {
                if (response === "Success") {
                    return;
                } else {
                    const [_, msg] = response.Error;
                    onResponseError?.(msg);
                }
            },
            NotificationsIndexAddFcmTokenArgs,
            UnitResult,
        );
    }
}
