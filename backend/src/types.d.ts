interface UserProfile {
    country: string;
    display_name: string;
    email: string;
    explicit_content: {
        filter_enabled: boolean,
        filter_locked: boolean
    },
    external_urls: { spotify: string; };
    followers: { href: string; total: number; };
    href: string;
    id: string;
    images: Image[];
    product: string;
    type: string;
    uri: string;
}

interface Image {
    url: string;
    height: number;
    width: number;
}

interface CurrentlyPlaying {
    is_playing: boolean;
    item: Track | null;
    progress_ms: number;
    device: Device;
}

interface Device {
    id: string;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string; // Ejemplo: "Computer", "Smartphone"
    volume_percent: number;
}

interface Track {
    name: string;
    album: Album;
    artists: Artist[];
    duration_ms: number;
}

interface Album {
    name: string;
    images: Image[];
}

interface Artist {
    name: string;
    href: string;
}