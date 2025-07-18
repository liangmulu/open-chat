use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::{format_ident, quote};
use serde::Deserialize;
use serde_tokenstream::from_tokenstream;
use std::fmt::Formatter;
use syn::parse::{Parse, ParseStream};
use syn::{Block, FnArg, Ident, ItemFn, LitBool, Pat, PatIdent, PatType, ReturnType, Signature, Token, parse_macro_input};

enum MethodType {
    Init,
    PostUpgrade,
    Update,
    Query,
}

impl std::fmt::Display for MethodType {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            MethodType::Init => f.write_str("init"),
            MethodType::PostUpgrade => f.write_str("post_upgrade"),
            MethodType::Update => f.write_str("update"),
            MethodType::Query => f.write_str("query"),
        }
    }
}

#[derive(Deserialize)]
struct AttributeInput {
    pub name: Option<String>,
    pub guard: Option<String>,
    #[serde(default)]
    pub composite: bool,
    #[serde(default)]
    pub candid: bool,
    #[serde(default)]
    pub msgpack: bool,
    #[serde(default)]
    pub json: bool,
    #[serde(default)]
    pub manual_reply: bool,
}

#[proc_macro_attribute]
pub fn init(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Init, attr, item)
}

#[proc_macro_attribute]
pub fn post_upgrade(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::PostUpgrade, attr, item)
}

#[proc_macro_attribute]
pub fn update(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Update, attr, item)
}

#[proc_macro_attribute]
pub fn query(attr: TokenStream, item: TokenStream) -> TokenStream {
    canister_api_method(MethodType::Query, attr, item)
}

fn canister_api_method(method_type: MethodType, attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let item = parse_macro_input!(item as ItemFn);
    let is_lifecycle = matches!(method_type, MethodType::Init | MethodType::PostUpgrade);
    let method_type = Ident::new(method_type.to_string().as_str(), Span::call_site());

    let mut attrs = Vec::new();

    let name = match attr.name {
        Some(name) => {
            attrs.push(quote! { name = #name });
            name
        }
        None => item.sig.ident.to_string(),
    };
    if let Some(guard) = attr.guard {
        attrs.push(quote! { guard = #guard });
    }
    if attr.composite {
        attrs.push(quote! { composite = true });
    }
    if attr.manual_reply {
        attrs.push(quote! { manual_reply = "true" });
    }

    let empty_args = item.sig.inputs.is_empty();
    let empty_return = matches!(item.sig.output, ReturnType::Default);

    let candid = if attr.candid {
        quote! {
            #[ic_cdk::#method_type(#(#attrs),*)]
            #item
        }
    } else {
        quote! {}
    };

    let msgpack = if attr.msgpack {
        let mut msgpack_attrs = attrs.clone();
        let msgpack_name = if is_lifecycle { name.clone() } else { format!("{name}_msgpack") };

        if !is_lifecycle {
            msgpack_attrs.push(quote! { name = #msgpack_name });
        }

        let serializer = if is_lifecycle {
            quote! {}
        } else {
            let serializer_func = if empty_return {
                quote! { msgpack::serialize_empty }
            } else {
                quote! { msgpack::serialize_then_unwrap }
            };

            let serializer_name = format!("{msgpack_name}_serializer");
            let serializer_ident = Ident::new(&serializer_name, Span::call_site());
            msgpack_attrs.push(quote! { encode_with = #serializer_name });

            quote! { use #serializer_func as #serializer_ident; }
        };

        let deserializer = {
            let deserializer_func = if empty_args {
                quote! { msgpack::deserialize_empty }
            } else {
                quote! { msgpack::deserialize_owned_then_unwrap }
            };

            let deserializer_name = format!("{msgpack_name}_deserializer");
            let deserializer_ident = Ident::new(&deserializer_name, Span::call_site());

            msgpack_attrs.push(quote! { decode_with = #deserializer_name });
            quote! { use #deserializer_func as #deserializer_ident; }
        };

        let mut msgpack_item = item.clone();
        msgpack_item.sig.ident = Ident::new(&msgpack_name, Span::call_site());

        quote! {
            #serializer
            #deserializer

            #[ic_cdk::#method_type(#(#msgpack_attrs),*)]
            #msgpack_item
        }
    } else {
        quote! {}
    };

    let json = if attr.json {
        let mut json_attrs = attrs.clone();
        let json_name = if is_lifecycle { name.clone() } else { format!("{name}_json") };

        if !is_lifecycle {
            json_attrs.push(quote! { name = #json_name });
        }

        let serializer = if is_lifecycle {
            quote! {}
        } else {
            let serializer_func = if empty_return {
                quote! { json::serialize_empty }
            } else {
                quote! { json::serialize_then_unwrap }
            };

            let serializer_name = format!("{json_name}_serializer");
            let serializer_ident = Ident::new(&serializer_name, Span::call_site());
            json_attrs.push(quote! { encode_with = #serializer_name });

            quote! { use #serializer_func as #serializer_ident; }
        };

        let deserializer = {
            let deserializer_func = if empty_args {
                quote! { json::deserialize_empty }
            } else {
                quote! { json::deserialize_owned_then_unwrap }
            };

            let deserializer_name = format!("{json_name}_deserializer");
            let deserializer_ident = Ident::new(&deserializer_name, Span::call_site());

            json_attrs.push(quote! { decode_with = #deserializer_name });
            quote! { use #deserializer_func as #deserializer_ident; }
        };

        let mut json_item = item.clone();
        json_item.sig.ident = Ident::new(&json_name, Span::call_site());

        quote! {
            #serializer
            #deserializer

            #[ic_cdk::#method_type(#(#json_attrs),*)]
            #json_item
        }
    } else {
        quote! {}
    };

    TokenStream::from(quote! {
        #candid
        #msgpack
        #json
    })
}

#[proc_macro_attribute]
pub fn proposal(attr: TokenStream, item: TokenStream) -> TokenStream {
    let attr: AttributeInput = from_tokenstream(&attr.into()).unwrap();
    let original_fn = parse_macro_input!(item as ItemFn);

    let name = attr.name.unwrap_or_else(|| original_fn.sig.ident.to_string());
    let validate_fn_name = format!("{name}_validate");
    let guard = attr.guard.map(|g| quote! { guard = #g, });
    let manual_reply = attr.manual_reply.then_some(quote! { manual_reply = "true", });

    let validate_fn = convert_to_validate_fn(original_fn.clone());

    TokenStream::from(quote! {
        #[ic_cdk::query(name = #validate_fn_name, #guard #manual_reply)]
        #validate_fn

        #[ic_cdk::update(name = #name, #guard #manual_reply)]
        #original_fn
    })
}

#[proc_macro]
pub fn proposal_validation(input: TokenStream) -> TokenStream {
    let attribute = parse_macro_input!(input as ValidationMethodAttribute);

    let their_service_name = format_ident!("{}", attribute.service_name);
    let their_function_name = format_ident!("{}", attribute.function_name);
    let our_function_name = format_ident!("{}_{}_validate", attribute.service_name, attribute.function_name);

    let args_type = quote! { #their_service_name::#their_function_name::Args };

    let to_string_fn = if attribute.convert_to_human_readable {
        quote! {
            human_readable::to_human_readable_string(&args)
        }
    } else {
        quote! {
            serde_json::to_string_pretty(&args).map_err(|e| e.to_string())
        }
    };

    let tokens = quote! {
        #[ic_cdk::query]
        fn #our_function_name(args: #args_type) -> Result<String, String> {
            #to_string_fn
        }
    };

    TokenStream::from(tokens)
}

fn convert_to_validate_fn(original: ItemFn) -> ItemFn {
    let mut sig = original.sig;
    let name = format!("{}_validate", sig.ident);
    sig.ident = Ident::new(&name, Span::call_site());
    sig.output = syn::parse2(quote!(-> Result<String, String>)).unwrap();
    sig.asyncness = None;

    let arg_names = get_arg_names(&sig);
    let args = match arg_names.len() {
        1 => quote! { #(#arg_names),* },
        _ => quote! { (#(#arg_names),*) },
    };

    let block: Block = syn::parse2(quote! {
        {
            human_readable::to_human_readable_string(&#args)
        }
    })
    .unwrap();

    ItemFn {
        attrs: original.attrs,
        vis: original.vis,
        sig,
        block: Box::new(block),
    }
}

fn get_arg_names(signature: &Signature) -> Vec<Ident> {
    signature
        .inputs
        .iter()
        .map(|arg| match arg {
            FnArg::Receiver(r) => r.self_token.into(),
            FnArg::Typed(PatType { pat, .. }) => {
                if let Pat::Ident(PatIdent { ident, .. }) = pat.as_ref() {
                    ident.clone()
                } else {
                    panic!("Unable to determine arg name");
                }
            }
        })
        .collect()
}

struct ValidationMethodAttribute {
    service_name: String,
    function_name: String,
    convert_to_human_readable: bool,
}

impl Parse for ValidationMethodAttribute {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let service_name: Ident = input.parse()?;
        let _: Token![,] = input.parse()?;
        let function_name: Ident = input.parse()?;
        let _: Token![,] = input.parse()?;
        let convert_to_human_readable = if input.is_empty() {
            true
        } else {
            let b: LitBool = input.parse()?;
            b.value()
        };

        Ok(ValidationMethodAttribute {
            service_name: service_name.to_string(),
            function_name: function_name.to_string(),
            convert_to_human_readable,
        })
    }
}
