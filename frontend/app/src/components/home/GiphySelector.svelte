<script lang="ts">
    import {
        type GiphyContent,
        mobileWidth,
        type TenorObject,
        type TenorSearchResponse,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Input from "../Input.svelte";
    import Link from "../Link.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "../Translatable.svelte";

    type KeyedTenorObject = TenorObject & { key: string };

    interface Props {
        open: boolean;
        onSend: (content: GiphyContent) => void;
    }

    let { open = $bindable(), onSend }: Props = $props();

    let refreshing = false;
    let message = $state("");
    let searchTerm = $state("");
    let gifs: KeyedTenorObject[] = $state([]);
    let gifCache: Record<
        string,
        KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
    > = $state({});
    let timer: number | undefined;
    let modalWidth = $state(0);
    let pageSize = 25;
    let selectedGif: KeyedTenorObject | undefined = $state();
    let containerElement: HTMLDivElement;
    const gutter = 5;
    let imgWidth = $state(0);
    let pos = "";

    const TRENDING_API_URL = `https://tenor.googleapis.com/v2/featured?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}`;
    const SEARCH_API_URL = `https://tenor.googleapis.com/v2/search?contentfilter=off&media_filter=tinygif,mediumgif,mp4&key=${
        import.meta.env.OC_TENOR_APIKEY
    }&limit=${pageSize}&q=`;

    function sumOfHeightsForColumn(
        cache: Record<
            string,
            KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
        >,
        row: number,
        col: number,
    ): number {
        let height = 0;
        for (let i = 0; i < row; i++) {
            const gif = cache[`${i}_${col}`];
            if (gif !== undefined) {
                height += gif.calculatedHeight;
            }
        }
        return height;
    }

    function reduceGifs(
        numCols: number,
        cache: Record<
            string,
            KeyedTenorObject & { top: number; left: number; calculatedHeight: number }
        >,
        gif: KeyedTenorObject,
        i: number,
    ): Record<string, KeyedTenorObject & { top: number; left: number; calculatedHeight: number }> {
        const col = i % numCols;
        const row = Math.floor(i / numCols);
        const scale = gif.media_formats.tinygif.dims[0] / imgWidth;
        const calcHeight = gif.media_formats.tinygif.dims[1] / scale;
        const key = `${row}_${col}`;

        cache[key] = {
            ...gif,
            top: sumOfHeightsForColumn(cache, row, col) + row * gutter,
            left: col * imgWidth + col * gutter,
            calculatedHeight: calcHeight,
        };
        return cache;
    }

    function onChange(val: string | number | bigint) {
        if (typeof val !== "string") return;

        if (val === searchTerm) {
            return;
        }

        searchTerm = val;
        if (timer !== undefined) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            if (searchTerm.length > 2) {
                reset(searchTerm);
            }
        }, 500);
    }

    function addKey(index: number, pos: string, gif: TenorObject): KeyedTenorObject {
        return {
            key: `${index}_${pos}`,
            ...gif,
        };
    }

    function getMoreGifs() {
        refreshing = true;
        const url =
            searchTerm === ""
                ? `${TRENDING_API_URL}&pos=${pos}`
                : `${SEARCH_API_URL}${searchTerm}&pos=${pos}`;
        return fetch(url)
            .then((res) => res.json())
            .then((res: TenorSearchResponse) => {
                pos = `${res.next}`;
                return res.results;
            })
            .then((res) => res.map((result, i) => addKey(i, pos, result)))
            .finally(() => (refreshing = false));
    }

    export function reset(search: string) {
        message = "";
        searchTerm = search;
        selectedGif = undefined;
        gifs = [];
        pos = "";
        nextPage();
    }

    function send(e: Event) {
        e.preventDefault();
        if (selectedGif !== undefined) {
            const content: GiphyContent = {
                kind: "giphy_content",
                title: selectedGif.title,
                desktop: {
                    height: Number(selectedGif.media_formats.mp4.dims[1]),
                    width: Number(selectedGif.media_formats.mp4.dims[0]),
                    url: selectedGif.media_formats.mp4.url,
                    mimeType: "video/mp4",
                },
                mobile: {
                    height: Number(selectedGif.media_formats.tinygif.dims[1]),
                    width: Number(selectedGif.media_formats.tinygif.dims[0]),
                    url: selectedGif.media_formats.tinygif.url,
                    mimeType: "image/gif",
                },
                caption: message === "" ? undefined : message,
            };
            onSend(content);
            open = false;
        }
    }

    function selectGif(gif: KeyedTenorObject) {
        selectedGif = gif;
    }

    function clearSelectedGif() {
        selectedGif = undefined;
    }

    async function nextPage() {
        if (refreshing) return;
        const nextPage = await getMoreGifs();
        gifs = [...gifs, ...nextPage];
    }

    function onScroll() {
        if (containerElement) {
            if (
                Math.abs(
                    containerElement.scrollHeight -
                        containerElement.clientHeight -
                        containerElement.scrollTop,
                ) < 200
            ) {
                nextPage();
            }
        }
    }
    let selectedImage = $derived(
        selectedGif === undefined
            ? undefined
            : $mobileWidth
              ? { ...selectedGif.media_formats.tinygif }
              : { ...selectedGif.media_formats.mediumgif },
    );
    $effect(() => {
        let containerWidth = containerElement?.clientWidth ?? 0;
        let numCols = $mobileWidth ? 2 : 4;
        let availWidth = containerWidth - (numCols - 1) * gutter;
        imgWidth = availWidth / numCols;
        gifCache = gifs.reduce((cache, gif, i) => reduceGifs(numCols, cache, gif, i), {});
    });
</script>

{#if open}
    <Overlay dismissible>
        <ModalContent large bind:actualWidth={modalWidth}>
            {#snippet header()}
                <div class="header">
                    <div class="title">
                        <Translatable resourceKey={i18nKey("sendGif")} />
                    </div>
                    <div class="gif-search">
                        <Input
                            maxlength={100}
                            type={"text"}
                            autofocus
                            countdown
                            placeholder={i18nKey("search")}
                            {onChange}
                            value={searchTerm} />
                    </div>
                </div>
            {/snippet}
            {#snippet body()}
                <form class="gif-body" onsubmit={send}>
                    {#if selectedImage !== undefined}
                        <div class="selected">
                            <img
                                class:landscape={selectedImage.dims[0] > selectedImage.dims[1]}
                                src={selectedImage.url}
                                alt={selectedGif?.title} />
                        </div>
                    {:else}
                        <div
                            class="giphy-container"
                            onscroll={onScroll}
                            bind:this={containerElement}>
                            {#each Object.values(gifCache) as item (item.key)}
                                <img
                                    class="thumb"
                                    onclick={() => selectGif(item)}
                                    src={item.media_formats.tinygif.url}
                                    style={`width: ${imgWidth}px; top: ${item.top}px; left: ${item.left}px`}
                                    alt={item.title} />
                            {/each}
                        </div>
                    {/if}
                    {#if selectedGif === undefined}
                        <div class="powered-by">
                            <img src="/assets/powered_by_tenor.svg" alt="Powered by Tenor" />
                        </div>
                    {/if}
                    <div class="message">
                        <Input
                            maxlength={100}
                            type={"text"}
                            autofocus={false}
                            countdown
                            placeholder={i18nKey("tokenTransfer.messagePlaceholder")}
                            bind:value={message} />
                    </div>
                </form>
            {/snippet}
            {#snippet footer()}
                <span class="footer" class:selected={selectedGif !== undefined}>
                    {#if selectedGif !== undefined}
                        <span class="close">
                            <Link underline={"always"} onClick={clearSelectedGif}>
                                <Translatable resourceKey={i18nKey("back")} />
                            </Link>
                        </span>
                    {/if}
                    <ButtonGroup align={$mobileWidth ? "center" : "end"}>
                        <Button small secondary onClick={() => (open = false)}
                            ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                        <Button small disabled={selectedGif === undefined} onClick={send}
                            ><Translatable resourceKey={i18nKey("send")} /></Button>
                    </ButtonGroup>
                </span>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    :global(.gif-body .input-wrapper) {
        margin-bottom: 0;
    }

    .giphy-container {
        overflow: auto;
        position: relative;
        height: calc(var(--vh, 1vh) * 60);

        @include mobile() {
            height: calc(var(--vh, 1vh) * 50);
        }
    }

    :global(.gif-search .input-wrapper) {
        margin-bottom: 0;
    }

    .powered-by {
        text-align: center;
        background-color: black;
        padding: $sp3 0;

        img {
            max-width: 300px;
            @include mobile() {
                max-width: 200px;
            }
        }
    }

    .header {
        display: flex;
        gap: $sp4;
        align-items: center;

        .gif-search {
            flex: auto;
        }
    }

    .selected {
        display: flex;
        justify-content: center;
        align-items: center;

        img {
            display: block;
            width: 100%;
            max-width: 100%;
            height: auto;
            max-height: calc(var(--vh, 1vh) * 50);

            &:not(.landscape) {
                width: auto;
            }
        }
    }

    .gif-body {
        position: relative;

        .thumb {
            position: absolute;
            cursor: pointer;
            display: block;
        }

        .message {
            padding-top: $sp3;
        }
    }

    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;

        &.selected {
            justify-content: space-between;
        }

        @include mobile() {
            justify-content: center;
        }
    }
</style>
