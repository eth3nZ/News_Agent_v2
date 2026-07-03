/// Baidu Translate API implementation.
///
/// Uses a blocking HTTP client (`ureq`) and pure-Rust crypto (`md-5`)
/// to avoid any dependency on system OpenSSL.
///
/// API reference: https://fanyi-api.baidu.com/doc/21
///
/// Sign algorithm:
///   sign = MD5(appid + q + salt + secret_key)
///   where salt = random_u64, and q must be URL-encoded in the final request

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::command;
use serde::{Deserialize, Serialize};
use md5::{Md5, Digest};

#[derive(Debug, Deserialize)]
pub struct TranslateRequest {
    /// Texts to translate (each entry is one segment, joined by newline for batching)
    pub texts: Vec<String>,
    /// Baidu API app ID
    pub app_id: String,
    /// Baidu API secret key
    pub secret_key: String,
    /// Source language code (e.g. "en", "zh")
    pub from: String,
    /// Target language code (e.g. "zh", "en")
    pub to: String,
}

#[derive(Debug, Serialize)]
pub struct TranslateResponse {
    /// Map from original text -> translated text
    pub translations: HashMap<String, String>,
    /// Error message if any (null when successful)
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BaiduTranslateResult {
    trans_result: Option<Vec<BaiduTransItem>>,
    error_code: Option<String>,
    error_msg: Option<String>,
}

#[derive(Debug, Deserialize)]
struct BaiduTransItem {
    src: String,
    dst: String,
}

/// Tauri command: translate texts via Baidu Translate API.
#[command]
pub async fn baidu_translate(request: TranslateRequest) -> TranslateResponse {
    let endpoint = "https://fanyi-api.baidu.com";
    let path = "/api/trans/vip/translate";

    let q = request.texts.join("\n");
    let salt = fastrand();

    // sign = MD5(appid + q + salt + secret_key)
    let sign_input = format!("{}{}{}{}", request.app_id, q, salt, request.secret_key);
    let mut hasher = Md5::new();
    hasher.update(sign_input.as_bytes());
    let digest = hasher.finalize();
    let sign = format!("{:x}", digest);

    // Build POST body as x-www-form-urlencoded (Baidu API requires params in the POST body, not query string)
    let body = format!(
        "q={}&from={}&to={}&appid={}&salt={}&sign={}",
        urlencode(&q),
        request.from,
        request.to,
        request.app_id,
        salt,
        sign,
    );

    let url = format!("{}{}", endpoint, path);

    // ureq v3: POST with body as x-www-form-urlencoded
    match ureq::post(&url)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .send(body.as_bytes())
    {
        Ok(response) => {
            let mut resp_body = response.into_body();
            match resp_body.read_to_string() {
                Ok(body_str) => {
                    let body_str: String = body_str;
                    match serde_json::from_str::<BaiduTranslateResult>(&body_str) {
                        Ok(result) => {
                            if let Some(err_code) = result.error_code {
                                let debug_hint = if err_code == "54001" {
                                    " (Tip: Invalid Sign usually means your Baidu App ID or Secret Key is incorrect, or the API credentials are not activated. Verify them at https://fanyi-api.baidu.com)"
                                } else if err_code == "54003" {
                                    " (Tip: Rate limit exceeded — try again later)"
                                } else if err_code == "52001" {
                                    " (Tip: Baidu translation service temporarily unavailable, try again later)"
                                } else {
                                    ""
                                };
                                return TranslateResponse {
                                    translations: HashMap::new(),
                                    error: Some(format!(
                                        "Baidu API error {}: {}{}",
                                        err_code,
                                        result.error_msg.as_deref().unwrap_or("unknown error"),
                                        debug_hint,
                                    )),
                                };
                            }

                            let mut map = HashMap::new();
                            if let Some(items) = result.trans_result {
                                for item in items {
                                    map.insert(item.src, item.dst);
                                }
                            }
                            TranslateResponse {
                                translations: map,
                                error: None,
                            }
                        }
                        Err(e) => TranslateResponse {
                            translations: HashMap::new(),
                            error: Some(format!("Failed to parse Baidu JSON response: {}", e)),
                        },
                    }
                }
                Err(e) => TranslateResponse {
                    translations: HashMap::new(),
                    error: Some(format!("Failed to read response body: {}", e)),
                },
            }
        }
        Err(ureq::Error::StatusCode(code)) => {
            TranslateResponse {
                translations: HashMap::new(),
                error: Some(format!("Baidu API returned HTTP status code: {}", code)),
            }
        }
        Err(e) => TranslateResponse {
            translations: HashMap::new(),
            error: Some(format!("HTTP transport error: {}", e)),
        },
    }
}

/// URL-encode a string for use in query parameters.
/// This is needed because Baidu API rejects non-ASCII characters in the `q`
/// parameter if they are not percent-encoded (error 54001: Invalid Sign even
/// though the sign is computed correctly on the *raw* string).
fn urlencode(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        match byte {
            // unreserved characters (RFC 3986)
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            // space → %20 (Baidu expects %20, not +)
            b' ' => result.push_str("%20"),
            // all others → percent-encode
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

/// Generate a random salt value for Baidu API signing.
/// Uses nanosecond timestamp as a cheap source of randomness.
fn fastrand() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    // Combine high and low bits for more entropy
    ((nanos & 0xFFFFFFFF) as u64) ^ ((nanos >> 32) as u64) + 32768
}