"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { PublicLoad } from "@/lib/tracking";

type Props = { position: NonNullable<PublicLoad["position"]>; destination: PublicLoad["destination"] };

function truckIcon(heading: number | null) {
  const arrow =
    heading != null
      ? `<svg width="44" height="44" viewBox="0 0 44 44" style="transform:rotate(${heading}deg)"><path d="M22 4 L30 20 L22 16 L14 20 Z" fill="#1d4ed8" stroke="#fff" stroke-width="2"/></svg>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="position:relative;width:44px;height:44px">
      <div style="position:absolute;inset:0">${arrow}</div>
      <div style="position:absolute;left:13px;top:13px;width:18px;height:18px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>
    </div>`,
  });
}

const destIcon = L.divIcon({
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  html: `<div style="width:18px;height:18px;border-radius:4px;background:#0f1b33;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
});

export default function TruckMap({ position, destination }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const truck = useRef<L.Marker | null>(null);
  const dest = useRef<L.Marker | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([position.lat, position.lng], 9);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      truck.current = null;
      dest.current = null;
      fitted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create the map once; markers update below
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const here = L.latLng(position.lat, position.lng);
    if (!truck.current) truck.current = L.marker(here, { icon: truckIcon(position.heading) }).addTo(m);
    else truck.current.setLatLng(here).setIcon(truckIcon(position.heading));

    const there = destination?.lat && destination?.lng ? L.latLng(destination.lat, destination.lng) : null;
    if (there && !dest.current) dest.current = L.marker(there, { icon: destIcon }).addTo(m);
    else if (there) dest.current?.setLatLng(there);
    else if (dest.current) {
      dest.current.remove();
      dest.current = null;
    }

    // Frame the truck (and destination) once; after that, let the customer pan freely.
    if (!fitted.current) {
      if (there) m.fitBounds(L.latLngBounds([here, there]), { padding: [40, 40], maxZoom: 11 });
      else m.setView(here, 9);
      fitted.current = true;
    }
  }, [position, destination]);

  return <div ref={box} className="z-0 h-[300px] overflow-hidden rounded-card border border-line sm:h-[420px]" aria-label="Map showing the truck's location" />;
}
