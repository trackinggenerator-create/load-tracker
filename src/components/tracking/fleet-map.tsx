"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { PublicLoad } from "@/lib/tracking";

export type FleetPin = { key: string; number: number; label: string; position: NonNullable<PublicLoad["position"]> };

function pinIcon(n: number, moving: boolean) {
  const color = moving ? "#1d4ed8" : "#8a5300";
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div style="width:30px;height:30px;border-radius:50%;background:${color};color:#fff;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:grid;place-items:center;font:800 13px/1 system-ui,sans-serif">${n}</div>`,
  });
}

/** Every truck on one map, with numbered pins that match the numbers in the list. */
export default function FleetMap({ pins, onSelect }: { pins: FleetPin[]; onSelect: (key: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current).setView([37.5, -96], 4);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const p of pins) {
      L.marker([p.position.lat, p.position.lng], { icon: pinIcon(p.number, p.position.moving), title: p.label, keyboard: true })
        .on("click", () => select.current(p.key))
        .addTo(g);
    }
    // Frame all the trucks once; after that, let the customer pan freely.
    if (!fitted.current && pins.length > 0) {
      const bounds = L.latLngBounds(pins.map((p) => [p.position.lat, p.position.lng] as [number, number]));
      m.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
      fitted.current = true;
    }
  }, [pins]);

  return <div ref={box} className="z-0 h-[360px] overflow-hidden rounded-card border border-line sm:h-[480px]" aria-label="Map of all trucks" />;
}
