# To build run 'docker build . -t openchat'
FROM ubuntu:24.04 AS builder
SHELL ["bash", "-c"]

ARG git_commit_id
ARG rust_version=1.88.0
ARG canister_name

ENV GIT_COMMIT_ID=$git_commit_id
ENV TZ=UTC

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    apt -yq update && \
    apt -yqq install --no-install-recommends curl ca-certificates build-essential

# Install Rust and Cargo in /opt
ENV RUSTUP_HOME=/opt/rustup \
    CARGO_HOME=/opt/cargo \
    PATH=/cargo/bin:/opt/cargo/bin:$PATH

RUN curl --fail https://sh.rustup.rs -sSf \
        | sh -s -- -y --default-toolchain ${rust_version}-x86_64-unknown-linux-gnu --no-modify-path && \
    rustup default ${rust_version}-x86_64-unknown-linux-gnu && \
    rustup target add wasm32-unknown-unknown

# Install IC Wasm
RUN cargo install --version 0.9.0 ic-wasm

COPY . /build
WORKDIR /build

RUN if [[ -z "$canister_name" ]] ; then sh ./scripts/generate-all-canister-wasms.sh ; else sh ./scripts/generate-wasm.sh $canister_name ; fi
