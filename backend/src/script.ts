import { redirectToAuthCodeFlow, getAccessToken } from "./authCodeWithPkce";

const clientId = "b2f31fa68d8b46febedc8711d6729585";
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (!code) {
    redirectToAuthCodeFlow(clientId);
} else {
    const accessToken = await getAccessToken(clientId, code);
    const profile = await fetchProfile(accessToken);
    const listening = await fetchCurrentlyPlaying(accessToken);
    populateUI(profile, listening);

    // Configurar eventos de clic para los botones
    setupPlaybackControls(accessToken, profile);
    setupVolumeControl(accessToken);
    setupRepeatControl(accessToken);
    setupShuffleControl(accessToken);
}

async function fetchProfile(accessToken: string): Promise<UserProfile> {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    return await result.json();
}

async function fetchCurrentlyPlaying(accessToken: string): Promise<CurrentlyPlaying> {
    const result = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (result.status === 204 || result.status === 404) {
        // No se está reproduciendo nada actualmente
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
        document.getElementById("track")!.innerText = "No se está reproduciendo ninguna canción";
        document.getElementById("albumImage")!.setAttribute("src", "#");
    }

    // Set the volume control to the current volume
    const volumeControl = document.getElementById("volumeControl") as HTMLInputElement;
    volumeControl.value = listening.device.volume_percent.toString();
}

function setupPlaybackControls(accessToken: string, profile: UserProfile) {
    const prevButton = document.getElementById("prevButton")!;
    const nextButton = document.getElementById("nextButton")!;

    prevButton.addEventListener("click", async () => {
        await skipToPreviousTrack(accessToken);
        await delay(500); // Pausa de medio segundo
        const listening = await fetchCurrentlyPlaying(accessToken);
        populateUI(profile, listening);
    });

    nextButton.addEventListener("click", async () => {
        await skipToNextTrack(accessToken);
        await delay(500); // Pausa de medio segundo
        const listening = await fetchCurrentlyPlaying(accessToken);
        populateUI(profile, listening);
    });
}

function setupVolumeControl(accessToken: string) {
    const volumeControl = document.getElementById("volumeControl") as HTMLInputElement;

    volumeControl.addEventListener("input", async () => {
        const volume = parseInt(volumeControl.value);
        await setVolume(accessToken, volume);
    });
}

function setupRepeatControl(accessToken: string) {
    const repeatButton = document.getElementById("repeatButton")!;
    let repeatState: "off" | "track" | "context" = "off";

    repeatButton.addEventListener("click", async () => {
        repeatState = repeatState === "off" ? "context" : repeatState === "context" ? "track" : "off";
        await setRepeat(accessToken, repeatState);
    });
}

function setupShuffleControl(accessToken: string) {
    const shuffleButton = document.getElementById("shuffleButton")!;
    let shuffleState = false;

    shuffleButton.addEventListener("click", async () => {
        shuffleState = !shuffleState;
        await setShuffle(accessToken, shuffleState);
    });
}

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

// Función auxiliar para agregar un pequeño retraso
function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}