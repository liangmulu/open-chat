import type { MessageFormatter, UserLookup, UserSummary } from "openchat-shared";

export function formatLastOnlineDate(
    formatter: MessageFormatter,
    now: number,
    lastOnline: number,
): [string, boolean] {
    const secondsSinceLastOnline = (now - lastOnline) / 1000;

    const minutesSinceLastOnline = Math.floor(secondsSinceLastOnline / 60);

    if (minutesSinceLastOnline < 2) {
        return [formatter("onlineNow"), true];
    }

    let durationText: string;
    if (minutesSinceLastOnline < 60) {
        durationText = formatter("durationMins", {
            values: { duration: minutesSinceLastOnline },
        });
    } else {
        const hoursSinceLastOnline = Math.floor(minutesSinceLastOnline / 60);
        if (hoursSinceLastOnline === 1) {
            durationText = formatter("oneHour");
        } else if (hoursSinceLastOnline < 24) {
            durationText = formatter("durationHours", {
                values: { duration: hoursSinceLastOnline },
            });
        } else {
            const daysSinceLastOnline = Math.floor(hoursSinceLastOnline / 24);
            durationText =
                daysSinceLastOnline === 1
                    ? formatter("oneDay")
                    : formatter("durationDays", { values: { duration: daysSinceLastOnline } });
        }
    }
    return [formatter("lastOnline", { values: { duration: durationText } }), false];
}

export function buildUsernameList(
    formatter: MessageFormatter,
    userIds: Set<string>,
    myUserId: string | undefined,
    users: UserLookup,
    maxUsernames = 99,
): string {
    const includesMe = myUserId !== undefined ? userIds.has(myUserId) : false;

    let usernamesArray = Array.from(userIds)
        .slice(0, maxUsernames * 1.5)
        .map((uid) => [uid, users.get(uid)?.username])
        .filter(([uid, username]) => username !== undefined && uid !== myUserId)
        .map(([_, username]) => username);

    const missing = userIds.size - (usernamesArray.length + (includesMe ? 1 : 0));

    // If there are no usernames missing and we would otherwise say "and 1 more"
    // then just show that last username
    if (missing === 0 && usernamesArray.length === maxUsernames + 1) {
        maxUsernames++;
    }

    usernamesArray = usernamesArray.slice(0, maxUsernames);

    let usernames = usernamesArray.join(", ");

    if (includesMe) {
        usernames += usernames.length === 0 ? formatter("you") : formatter("reactions.andYou");
    }

    const n = userIds.size - (usernamesArray.length + (includesMe ? 1 : 0));

    if (n > 0) {
        usernames += formatter("andNMore", { values: { n } });
    }

    return usernames;
}

export function nullUser(username: string): UserSummary {
    return {
        kind: "user",
        userId: "null_user", // this might cause problems if we try to create a Principal from it
        username,
        displayName: undefined,
        updated: BigInt(0),
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        totalChitEarned: 0,
    };
}

export function compareUsername(u1: UserSummary, u2: UserSummary): number {
    return u1.username.localeCompare(u2.username, undefined, { sensitivity: "accent" });
}

export function compareIsNotYouThenUsername(
    yourUserId: string,
): (u1: UserSummary, u2: UserSummary) => number {
    return (u1: UserSummary, u2: UserSummary) => {
        const u1IsYou = u1.userId === yourUserId;
        const u2IsYou = u2.userId === yourUserId;
        if (u1IsYou !== u2IsYou) {
            return u1IsYou ? 1 : -1;
        }
        return compareUsername(u1, u2);
    };
}

export function userAvatarUrl<T extends { blobUrl?: string }>(dataContent?: T): string {
    return dataContent?.blobUrl ?? "/assets/unknownUserAvatar.svg";
}

export function missingUserIds(userLookup: UserLookup, webhookUserIds: Set<string>, userIds: Iterable<string>): string[] {
    const missing: string[] = [];
    for (const userId of userIds) {
        if (!userLookup.has(userId) && !webhookUserIds.has(userId)) {
            missing.push(userId);
        }
    }
    return missing;
}
