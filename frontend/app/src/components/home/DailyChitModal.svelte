<script lang="ts">
    import InfoIcon from "@src/components/InfoIcon.svelte";
    import {
        chitStateStore,
        iconSize,
        type OpenChat,
    } from "openchat-client";
    import { getContext, tick } from "svelte";
    import { Confetti } from "svelte-confetti";
    import ShieldHalfFull from "svelte-material-icons/ShieldHalfFull.svelte";
    import TrophyOutline from "svelte-material-icons/TrophyOutline.svelte";
    import { fade } from "svelte/transition";
    import { i18nKey } from "../../i18n/i18n";
    import { now500 } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Link from "../Link.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Progress from "../Progress.svelte";
    import Translatable from "../Translatable.svelte";
    import StreakInsuranceBuy from "./insurance/StreakInsuranceBuy.svelte";
    import ChitBalance from "./profile/ChitBalance.svelte";
    import LearnToEarn from "./profile/LearnToEarn.svelte";
    import Streak from "./profile/Streak.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose?: () => void;
        onLeaderboard: () => void;
    }

    let { onClose, onLeaderboard }: Props = $props();
    let busy = $state(false);
    let claimed = $state(false);
    let additional: number | undefined = $state(undefined);
    let learnToEarn = $state(false);
    let showInsurance = $state(false);

    function calculateBadgesVisible(streak: number): number[] {
        if (streak < 30) {
            return [3, 7, 14, 30];
        } else if (streak < 100) {
            return [14, 30, 100];
        } else {
            return [30, 100, 365];
        }
    }

    function calculatePercentage(currentStreak: number, maxBadge: number): number {
        const percent = (currentStreak / maxBadge) * 100;
        return percent > 100 ? 100 : percent;
    }

    function claim() {
        if (!available) return;

        busy = true;

        client
            .claimDailyChit()
            .then((resp) => {
                if (resp.kind === "success") {
                    claimed = true;
                    additional = resp.chitEarned;
                    window.setTimeout(() => {
                        additional = undefined;
                    }, 2000);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(i18nKey("dailyChit.failedToClaim"), err);
                onClose?.();
            })
            .finally(() => {
                busy = false;
            });

        // This is useful for testing so I'll leave it here for a bit
        // setTimeout(() => {
        //     streak += 1;
        //     claimed = true;
        //     busy = false;
        //     additional = 200;
        //     setTimeout(() => {
        //         claimed = false;
        //         additional = undefined;
        //     }, 2000);
        // }, 1000);
    }

    function leaderboard() {
        onClose?.();
        tick().then(onLeaderboard);
    }

    function earnMore(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        learnToEarn = true;
    }
    let available = $derived($chitStateStore.nextDailyChitClaim < $now500);
    let streak = $derived($chitStateStore.streakEnds < $now500 ? 0 : $chitStateStore.streak);
    let badgesVisible = $derived(calculateBadgesVisible(streak));
    let maxBadgeVisible = $derived(badgesVisible[badgesVisible.length - 1]);
    let percent = $derived(calculatePercentage(streak, maxBadgeVisible));
    let remaining = $derived(
        client.formatTimeRemaining($now500, Number($chitStateStore.nextDailyChitClaim), true),
    );
</script>

{#if learnToEarn}
    <LearnToEarn onClose={() => (learnToEarn = false)} />
{/if}

{#if showInsurance}
    <StreakInsuranceBuy onClose={() => (showInsurance = false)} />
{/if}

<ModalContent closeIcon {onClose}>
    {#snippet header()}
        <div class="header">
            <div class="leaderboard">
                <HoverIcon onclick={leaderboard}>
                    <TrophyOutline size={$iconSize} color={"var(--icon-txt)"} />
                </HoverIcon>
            </div>
            <Translatable resourceKey={i18nKey("dailyChit.title")} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class:available class="logo" onclick={claim}>
                <FancyLoader loop={busy} />
                <div class="streak">{streak}</div>
            </div>

            <div class="balance">
                <div class="spacer"></div>
                <div class="current">
                    <ChitBalance
                        totalEarned={$chitStateStore.totalChitEarned}
                        me={false}
                        size={"large"} />
                </div>
                <div class="additional">
                    {#if additional}
                        <div transition:fade={{ duration: 500 }}>{`+ ${additional}`}</div>
                    {/if}
                </div>
            </div>
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_missing_attribute -->
            <a class="earn-more" tabindex="0" onclick={earnMore} role="button">
                <Translatable resourceKey={i18nKey("profile.earnMore")} />
            </a>

            <p>
                <Translatable
                    resourceKey={i18nKey(
                        available ? "dailyChit.available" : "dailyChit.alreadyClaimed",
                    )} />
            </p>
            <p class="info">
                <Translatable resourceKey={i18nKey("dailyChit.info")} />
            </p>

            <div class="progress-wrapper">
                <div class="progress">
                    <Progress size={"20px"} {percent}></Progress>
                    <div class="marker" style="left: {percent}%">
                        <div class="line"></div>
                    </div>
                    <div class="badges">
                        {#each badgesVisible as badge}
                            <div class="badge" style="left: {(badge * 100) / maxBadgeVisible}%">
                                <Streak disabled={streak < badge} days={badge} />
                            </div>
                        {/each}
                    </div>
                </div>
            </div>

            {#if streak > 0}
                <Link onClick={() => (showInsurance = true)}>
                    <div class="insurance">
                        <ShieldHalfFull />
                        <Translatable resourceKey={i18nKey("streakInsurance.link")}></Translatable>
                        <InfoIcon align={"middle"}>
                            <Translatable resourceKey={i18nKey("streakInsurance.infoPopup")} />
                        </InfoIcon>
                    </div>
                </Link>
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        {#if claimed}
            <div class="confetti">
                <Confetti colorArray={["url(../assets/chit.svg)"]} />
            </div>
        {/if}
        <ButtonGroup align={"center"}>
            <Button loading={busy} disabled={!available} onClick={claim}>
                {#if available}
                    <Translatable resourceKey={i18nKey("dailyChit.claim")} />
                {:else}
                    <Translatable
                        resourceKey={i18nKey("dailyChit.comeback", { time: remaining })} />
                {/if}
            </Button>
        </ButtonGroup>
    {/snippet}
</ModalContent>

<style lang="scss">
    :root {
        --offset: -20px;
        --margin-top: -24px;
        --scale: 2.5;
        @include mobile() {
            --offset: -18px;
            --margin-top: -22px;
            --scale: 2;
        }
    }

    .header,
    .body {
        align-self: center;
        text-align: center;
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp3;
    }

    .progress-wrapper {
        width: 100%;
        padding: 0 $sp4;
    }

    .progress {
        position: relative;
        margin: $sp6 0 48px 0;
        width: 100%;

        @include mobile() {
            margin: $sp6 0 $sp6 0;
        }
    }

    .info {
        color: var(--txt-light);
        @include font(book, normal, fs-80);
    }

    .badges {
        margin-top: var(--margin-top);
        position: relative;

        .badge {
            position: absolute;
            transform-origin: 50% 50%;
            transform: translateX(var(--offset)) scale(var(--scale));
            transition:
                filter 300ms ease-in-out,
                transform 300ms ease-in-out;

            &:hover {
                transform: translateX(var(--offset)) scale(3);
            }
        }
    }

    .marker {
        position: absolute;
        top: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: left 300ms ease-in-out;
        transform: translateX(-50%);

        .line {
            width: 1px;
            flex: 0 0 20px;
            background-color: var(--bd);
        }
    }

    .confetti {
        position: absolute;
        pointer-events: none;
        top: 50%;
        left: 50%;
    }

    .logo {
        width: 120px;
        position: relative;

        @include mobile() {
            width: 100px;
        }

        &.available {
            cursor: pointer;
        }

        .streak {
            position: absolute;
            top: 48%;
            left: 50%;
            transform: translateX(-50%) translateY(-50%);
            @include font(bold, normal, fs-180);
        }
    }

    .balance {
        display: flex;
        gap: $sp4;
        justify-content: space-between;
        align-items: center;

        > * {
            white-space: nowrap;
        }

        .spacer,
        .additional {
            flex: 1;
            min-width: 0;
            color: var(--txt-light);
            color: var(--accent);
        }

        .current {
            flex-shrink: 0;
        }
    }

    .earn-more {
        color: var(--txt);
        text-decoration: underline;
        text-underline-offset: $sp2;
        align-self: center;
        margin: 0 0 $sp3 0;
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .leaderboard {
        position: absolute;
        top: $sp3;
        left: $sp3;
    }

    .insurance {
        display: flex;
        gap: $sp2;
        align-items: center;
        margin-bottom: $sp3;
    }
</style>
