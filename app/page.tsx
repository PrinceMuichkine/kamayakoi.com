import type { Metadata } from "next";
import { Component as Horizon } from "@/components/landing/horizon";
import Header from "@/components/landing/header";
import MinimalFooter from "@/components/landing/minimal-footer";
import AudioPlayer from "@/components/landing/audio-player";
import { getHomepageMusicTracks } from "@/lib/sanity/queries";
import MusicWrapper from "@/components/landing/music-wrapper";

// Use the general site metadata for the home page
export const metadata: Metadata = {
  title: "Kamayakoi",
  description: "Rendez-vous sauvage pour électrons libres.",
};

export default async function Home() {
  const musicTracks = await getHomepageMusicTracks();
  return (
    <MusicWrapper tracks={musicTracks}>
      <div className="relative">
        {/* Header positioned over the horizon */}
        <div className="absolute top-0 left-0 right-0 z-50">
          <Header />
        </div>

        {/* Desktop Audio Player - positioned on the left */}
        <div className="hidden md:block fixed top-1/2 left-6 transform -translate-y-1/2 z-40">
          <AudioPlayer />
        </div>

        {/* Horizon component */}
        <Horizon />

        {/* Minimal footer - positioned absolutely, only shows when horizon is fully scrolled */}
        <MinimalFooter />
      </div>
    </MusicWrapper>
  );
}
