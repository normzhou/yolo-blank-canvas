#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .on_page_load(|_webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Started) {
                let url = payload.url();
                if url.path() == "/auth/yolo/browser-start" {
                    let mut browser_url = url.clone();
                    let filtered_pairs: Vec<(String, String)> = url
                        .query_pairs()
                        .filter(|(k, _)| k != "launch")
                        .map(|(k, v)| (k.into_owned(), v.into_owned()))
                        .collect();
                    browser_url.query_pairs_mut().clear().extend_pairs(filtered_pairs);
                    open_in_system_browser(browser_url.as_str());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running yolo-arcade application");
}

fn open_in_system_browser(url: &str) {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("/usr/bin/open").arg(url).spawn();
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}
