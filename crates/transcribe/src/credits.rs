//! [`credits`]: how much credit the OpenRouter account has left, for the app
//! to show next to "Add credits" (TOS1).
//!
//! Two read-only calls with the user's own key, made at once:
//!
//! - `GET {base}/credits` gives `total_credits` and `total_usage` for the
//!   account; the balance is the difference. OpenRouter documents it as
//!   needing a management key, so a normal sign-in key may be refused: that
//!   is not an error here, the balance is then simply unknown.
//! - `GET {base}/key` works with any key and says whether the key has a
//!   spending limit (`limit`, `limit_remaining`; both `null` if unlimited).
//!
//! Whatever fails (a refusal, a slow answer, a body of another shape) leaves
//! that part out. The key goes only into the `Authorization` header; neither
//! the key nor a response body is ever logged or put into a result.

use std::time::Duration;

use dictation_ports::Secret;
use reqwest::Client;
use serde::Deserialize;

/// The most the lookup may take, in all. The window shows nothing rather than
/// wait longer.
pub const TIMEOUT: Duration = Duration::from_secs(2);

/// What the account's credit looks like. Amounts are US dollars.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Credits {
    /// Credit left on the account (bought minus used), never below zero.
    pub balance: Option<f64>,
    /// What is left of the key's own spending limit, if it has one.
    pub key_limit_left: Option<f64>,
}

#[derive(Deserialize)]
struct CreditsReply {
    data: CreditsData,
}

#[derive(Deserialize)]
struct CreditsData {
    total_credits: f64,
    total_usage: f64,
}

#[derive(Deserialize)]
struct KeyReply {
    data: KeyData,
}

#[derive(Deserialize)]
struct KeyData {
    limit: Option<f64>,
    limit_remaining: Option<f64>,
}

/// A dollar amount that can be shown: finite, and never negative.
fn money(value: f64) -> Option<f64> {
    value.is_finite().then(|| value.max(0.0))
}

/// Asks `base_url` for the credit `key` can spend. `None` if neither call
/// gave anything to show, or [`TIMEOUT`] passed first.
pub async fn credits(base_url: &str, key: &Secret) -> Option<Credits> {
    credits_within(base_url, key, TIMEOUT).await
}

/// [`credits`] with another time budget, for tests.
pub async fn credits_within(base_url: &str, key: &Secret, timeout: Duration) -> Option<Credits> {
    let client = crate::http::client(base_url).ok()?;
    let base = base_url.trim_end_matches('/');
    let (credits_url, key_url) = (format!("{base}/credits"), format!("{base}/key"));
    let both = async {
        tokio::join!(
            get::<CreditsReply>(&client, &credits_url, key, timeout),
            get::<KeyReply>(&client, &key_url, key, timeout),
        )
    };
    let (account, own) = tokio::time::timeout(timeout, both).await.ok()?;
    let balance =
        account.and_then(|reply| money(reply.data.total_credits - reply.data.total_usage));
    let key_limit_left = own.and_then(|reply| {
        // Only a limit that exists: an unlimited key has nothing to show.
        reply.data.limit?;
        reply.data.limit_remaining.and_then(money)
    });
    (balance.is_some() || key_limit_left.is_some()).then_some(Credits {
        balance,
        key_limit_left,
    })
}

/// One GET with the key; `None` for any status but 200 or a body of another
/// shape. Nothing about the reply is kept or logged.
async fn get<T: for<'de> Deserialize<'de>>(
    client: &Client,
    url: &str,
    key: &Secret,
    timeout: Duration,
) -> Option<T> {
    let response = client
        .get(url)
        .bearer_auth(key.expose())
        .timeout(timeout)
        .send()
        .await
        .ok()?;
    if response.status() != reqwest::StatusCode::OK {
        return None;
    }
    let body = response.bytes().await.ok()?;
    serde_json::from_slice(&body).ok()
}

#[cfg(test)]
#[allow(clippy::unwrap_used, reason = "tests fail on purpose")]
mod tests {
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use super::*;

    /// Obviously fake.
    const KEY: &str = "test-key-NOT-REAL-credits-1a2b3c";

    fn base(server: &MockServer) -> String {
        format!("{}/api/v1", server.uri())
    }

    async fn mount(server: &MockServer, route: &str, response: ResponseTemplate) {
        Mock::given(method("GET"))
            .and(path(format!("/api/v1/{route}")))
            .and(header("authorization", format!("Bearer {KEY}").as_str()))
            .respond_with(response)
            .mount(server)
            .await;
    }

    fn json(body: &str) -> ResponseTemplate {
        ResponseTemplate::new(200).set_body_raw(body, "application/json")
    }

    #[tokio::test]
    async fn the_balance_is_credits_bought_minus_used() {
        let server = MockServer::start().await;
        mount(
            &server,
            "credits",
            json(r#"{"data":{"total_credits":10.5,"total_usage":5.68}}"#),
        )
        .await;
        mount(
            &server,
            "key",
            json(r#"{"data":{"limit":null,"limit_remaining":null}}"#),
        )
        .await;
        let found = credits(&base(&server), &Secret::new(KEY.to_owned()))
            .await
            .unwrap();
        assert!((found.balance.unwrap() - 4.82).abs() < 1e-9);
        assert_eq!(
            found.key_limit_left, None,
            "an unlimited key shows no limit"
        );
    }

    #[tokio::test]
    async fn a_key_with_a_limit_shows_what_is_left_of_it() {
        let server = MockServer::start().await;
        mount(
            &server,
            "credits",
            json(r#"{"data":{"total_credits":10,"total_usage":1}}"#),
        )
        .await;
        mount(
            &server,
            "key",
            json(r#"{"data":{"limit":5,"limit_remaining":3.25}}"#),
        )
        .await;
        let found = credits(&base(&server), &Secret::new(KEY.to_owned()))
            .await
            .unwrap();
        assert_eq!(found.balance, Some(9.0));
        assert_eq!(found.key_limit_left, Some(3.25));
    }

    #[tokio::test]
    async fn credits_refused_to_a_normal_key_leaves_the_key_limit() {
        let server = MockServer::start().await;
        mount(&server, "credits", ResponseTemplate::new(403)).await;
        mount(
            &server,
            "key",
            json(r#"{"data":{"limit":5,"limit_remaining":2}}"#),
        )
        .await;
        let found = credits(&base(&server), &Secret::new(KEY.to_owned()))
            .await
            .unwrap();
        assert_eq!(found.balance, None);
        assert_eq!(found.key_limit_left, Some(2.0));
    }

    #[tokio::test]
    async fn overspent_credit_shows_zero_not_a_negative_amount() {
        let server = MockServer::start().await;
        mount(
            &server,
            "credits",
            json(r#"{"data":{"total_credits":5,"total_usage":5.01}}"#),
        )
        .await;
        let found = credits(&base(&server), &Secret::new(KEY.to_owned()))
            .await
            .unwrap();
        assert_eq!(found.balance, Some(0.0));
    }

    #[tokio::test]
    async fn nothing_to_show_when_both_calls_fail_or_have_another_shape() {
        let server = MockServer::start().await;
        mount(&server, "credits", json(r#"{"data":"nope"}"#)).await;
        mount(&server, "key", ResponseTemplate::new(500)).await;
        assert_eq!(
            credits(&base(&server), &Secret::new(KEY.to_owned())).await,
            None
        );
    }

    #[tokio::test]
    async fn a_wrong_key_gets_nothing() {
        let server = MockServer::start().await;
        mount(
            &server,
            "credits",
            json(r#"{"data":{"total_credits":10,"total_usage":1}}"#),
        )
        .await;
        assert_eq!(
            credits(
                &base(&server),
                &Secret::new("another-key-NOT-REAL".to_owned())
            )
            .await,
            None
        );
    }

    #[tokio::test]
    async fn a_slow_answer_is_given_up_on() {
        let server = MockServer::start().await;
        mount(
            &server,
            "credits",
            json(r#"{"data":{"total_credits":10,"total_usage":1}}"#)
                .set_delay(Duration::from_secs(3)),
        )
        .await;
        let started = std::time::Instant::now();
        let found = credits_within(
            &base(&server),
            &Secret::new(KEY.to_owned()),
            Duration::from_millis(200),
        )
        .await;
        assert_eq!(found, None);
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}
