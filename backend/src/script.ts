import { redirectToAuthCodeFlow, getAccessToken } from "./authCodeWithPkce";

const clientId = "b2f31fa68d8b46febedc8711d6729585";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");
let accessToken = sessionStorage.getItem("accessToken");

if (!accessToken) {
    if (!code) {
        redirectToAuthCodeFlow(clientId).catch(error => {
            console.error("Error during redirect to auth code flow:", error);
        });
    } else {
        try {
            accessToken = await getAccessToken(clientId, code);
            if (accessToken) {
                sessionStorage.setItem("accessToken", accessToken);
                const profile = await fetchProfile(accessToken);
                const listening = await fetchCurrentlyPlaying(accessToken);
                populateUI(profile, listening);

                // Configure click events for buttons
                setupPlaybackControls(accessToken, profile);
                setupVolumeControl(accessToken);
                setupRepeatControl(accessToken);
                setupShuffleControl(accessToken);
            } else {
                console.error("Failed to obtain access token");
            }
        } catch (error) {
            console.error("Error during authentication flow:", error);
        }
    }
} else {
    try {
        const profile = await fetchProfile(accessToken);
        const listening = await fetchCurrentlyPlaying(accessToken);
        populateUI(profile, listening);

        // Configure click events for buttons
        setupPlaybackControls(accessToken, profile);
        setupVolumeControl(accessToken);
        setupRepeatControl(accessToken);
        setupShuffleControl(accessToken);
    } catch (error) {
        console.error("Error using stored access token:", error);
        sessionStorage.removeItem("accessToken");
        redirectToAuthCodeFlow(clientId).catch(error => {
            console.error("Error during redirect to auth code flow:", error);
        });
    }
}

/**
 * Fetches the user's profile from Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 * @returns {Promise<UserProfile>} - The user's profile.
 */
async function fetchProfile(accessToken: string): Promise<UserProfile> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    return await result.json();
}

/**
 * Fetches the currently playing track from Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 * @returns {Promise<CurrentlyPlaying>} - The currently playing track.
 */
async function fetchCurrentlyPlaying(accessToken: string): Promise<CurrentlyPlaying> {
    const result = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (result.status === 204 || result.status === 404) {
        // No track is currently playing
        return {
            is_playing: false,
            item: null,
            progress_ms: 0,
            device: {
                id: "",
                is_active: false,
                is_private_session: false,
                is_restricted: false,
                name: "Unknown",
                type: "Unknown",
                volume_percent: 0,
            },
        };
    }

    console.log(result);
    return await result.json();
}

/**
 * Populates the UI with the user's profile and currently playing track.
 * @param {UserProfile} profile - The user's profile.
 * @param {CurrentlyPlaying} listening - The currently playing track.
 */
function populateUI(profile: UserProfile, listening: CurrentlyPlaying) {
    document.getElementById("id")!.innerText = profile.display_name;
    document.getElementById("avatar")!.setAttribute("src", profile.images[0]?.url || "#");
    document.getElementById("id")!.innerText = profile.id;
    document.getElementById("email")!.innerText = profile.email;
    document.getElementById("uri")!.innerText = profile.uri;
    document.getElementById("uri")!.setAttribute("href", profile.external_urls.spotify);
    document.getElementById("url")!.innerText = profile.href;
    document.getElementById("url")!.setAttribute("href", profile.href);
    document.getElementById("imgUrl")!.innerText = profile.images[0]?.url || "No image available";

    if (listening.item) {
        const track = listening.item;
        const artistNames = track.artists.map((artist) => artist.name).join(", ");
        document.getElementById("track")!.innerText = `${track.name} by ${artistNames}`;
        document.getElementById("albumImage")!.setAttribute("src", track.album.images[0]?.url || "#");
    } else {
        document.getElementById("track")!.innerText = "No track is currently playing";
        document.getElementById("albumImage")!.setAttribute("src", "#");
    }

    // Set the volume control to the current volume
    const volumeControl = document.getElementById("volumeControl") as HTMLInputElement;
    volumeControl.value = listening.device.volume_percent.toString();
}

/**
 * Sets up playback control buttons.
 * @param {string} accessToken - The access token for Spotify API.
 * @param {UserProfile} profile - The user's profile.
 */
function setupPlaybackControls(accessToken: string, profile: UserProfile) {
    const prevButton = document.getElementById("prevButton")!;
    const nextButton = document.getElementById("nextButton")!;

    prevButton.addEventListener("click", async () => {
        await skipToPreviousTrack(accessToken);
        await delay(500); // Half-second pause
        const listening = await fetchCurrentlyPlaying(accessToken);
        populateUI(profile, listening);
    });

    nextButton.addEventListener("click", async () => {
        await skipToNextTrack(accessToken);
        await delay(500); // Half-second pause
        const listening = await fetchCurrentlyPlaying(accessToken);
        populateUI(profile, listening);
    });
}

/**
 * Sets up the volume control.
 * @param {string} accessToken - The access token for Spotify API.
 */
function setupVolumeControl(accessToken: string) {
    const volumeControl = document.getElementById("volumeControl") as HTMLInputElement;

    volumeControl.addEventListener("input", async () => {
        const volume = parseInt(volumeControl.value);
        await setVolume(accessToken, volume);
    });
}

/**
 * Sets up the repeat control button.
 * @param {string} accessToken - The access token for Spotify API.
 */
function setupRepeatControl(accessToken: string) {
    const repeatButton = document.getElementById("repeatButton")!;
    let repeatState: "off" | "track" | "context" = "off";

    repeatButton.addEventListener("click", async () => {
        repeatState = repeatState === "off" ? "context" : repeatState === "context" ? "track" : "off";
        await setRepeat(accessToken, repeatState);
    });
}

/**
 * Sets up the shuffle control button.
 * @param {string} accessToken - The access token for Spotify API.
 */
function setupShuffleControl(accessToken: string) {
    const shuffleButton = document.getElementById("shuffleButton")!;
    let shuffleState = false;

    shuffleButton.addEventListener("click", async () => {
        shuffleState = !shuffleState;
        await setShuffle(accessToken, shuffleState);
    });
}

/**
 * Sets the volume on Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 * @param {number} volume - The volume level to set (0-100).
 */
async function setVolume(accessToken: string, volume: number) {
    const result = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${volume}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.status === 204) {
        console.log("Volume set to", volume);
    } else if (result.status === 401) {
        console.error("Unauthorized: Check your token and scopes.");
    } else {
        console.error("Failed to set volume", result.status);
    }
}

/**
 * Sets the repeat mode on Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 * @param {"off" | "track" | "context"} state - The repeat mode to set.
 */
async function setRepeat(accessToken: string, state: "off" | "track" | "context") {
    const result = await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${state}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.status === 204) {
        console.log("Repeat mode set to", state);
    } else if (result.status === 401) {
        console.error("Unauthorized: Check your token and scopes.");
    } else {
        console.error("Failed to set repeat mode", result.status);
    }
}

/**
 * Sets the shuffle mode on Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 * @param {boolean} state - The shuffle mode to set.
 */
async function setShuffle(accessToken: string, state: boolean) {
    const result = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${state}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.status === 204) {
        console.log("Shuffle mode set to", state);
    } else if (result.status === 401) {
        console.error("Unauthorized: Check your token and scopes.");
    } else {
        console.error("Failed to set shuffle mode", result.status);
    }
}

/**
 * Skips to the previous track on Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 */
async function skipToPreviousTrack(accessToken: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/previous", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.status === 204) {
        console.log("Skipped to the previous track");
    } else if (result.status === 401) {
        console.error("Unauthorized: Check your token and scopes.");
    } else {
        console.error("Failed to skip to the previous track", result.status);
    }
}

/**
 * Skips to the next track on Spotify.
 * @param {string} accessToken - The access token for Spotify API.
 */
async function skipToNextTrack(accessToken: string) {
    const result = await fetch("https://api.spotify.com/v1/me/player/next", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (result.status === 204) {
        console.log("Skipped to the next track");
    } else if (result.status === 401) {
        console.error("Unauthorized: Check your token and scopes.");
    } else {
        console.error("Failed to skip to the next track", result.status);
    }
}

/**
 * Helper function to add a small delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>} - A promise that resolves after the delay.
 */
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}