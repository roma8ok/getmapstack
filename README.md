# Getmapstack

<div align="center">

**[Quick start](#quick-start)** · **[Countries](#countries)** · **[What you get](#what-you-get)** · **[Build it yourself](#build-it-yourself)**

</div>

**Self-hosted mapping stack. One command per country.**

Replace Google Maps API - no API keys, no rate limits, no vendor lock-in.

**[Live demo](https://roma8ok.github.io/getmapstack/demo/isochrone-wave/)** - a recorded 15-minute isochrone
wave over three travel modes, then the `docker run` command to compute your own.

Routing via [Valhalla](https://valhalla.github.io/valhalla/) 3.8.3, geocoding via
[Photon](https://github.com/komoot/photon) 1.2.1, vector basemap tiles via
[Martin 1.13.0](https://github.com/maplibre/martin) (built with
[Planetiler 0.10.2](https://github.com/onthegomap/planetiler)).

<img src="https://raw.githubusercontent.com/roma8ok/getmapstack/main/assets/how-it-works.svg" width="880" alt="One docker run command starts a container that publishes a single port, 4326. Your application sends POST /valhalla/route, GET /photon/api and GET /martin/basemap/{z}/{x}/{y} to that one port, and each prefix reaches its own service inside the container: Valhalla for routing, Photon for geocoding, Martin for vector tiles, over country OSM data baked into the image.">

## Quick start

```bash
docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cyprus
```

Images are multi-arch: linux/amd64 and linux/arm64 (Apple Silicon, AWS Graviton).

Once it starts, open `http://localhost:4326` for the explorer - one page that drives all
three engines (routes, isochrones, matrices, geocoding, server-rendered images) and shows
the matching command next to every answer. The map catalog UI - the vector tileset, style,
fonts and sprites - is at `http://localhost:4326/martin/`.

Give it a moment to start - Photon opens its search index in a few seconds for a country
this size, several minutes for the largest ones. `curl -sf localhost:4326/healthz` answers
`{"status":"ok"}` once all three engines are up, and the container's own healthcheck runs
that same probe, so `docker ps` reports `healthy` at the same moment. Then check that it
answers, a car route from Nicosia to Limassol:

```bash
curl localhost:4326/valhalla/route \
  -d '{"locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],"costing":"auto"}'
```

```json
{"trip":{"summary":{"length":84.736,"time":3770.219,"has_highway":true}}}
```

Every other method is in [What you get](#what-you-get).

## Countries

| | Country | Size | Run |
|---|---------|------|-----|
| 🇦🇫 | Afghanistan | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/afghanistan` |
| 🇦🇱 | Albania | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/albania` |
| 🇩🇿 | Algeria | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/algeria` |
| 🇦🇩 | Andorra | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/andorra` |
| 🇦🇴 | Angola | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/angola` |
| 🇦🇷 | Argentina | 8.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/argentina` |
| 🇦🇲 | Armenia | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/armenia` |
| 🇦🇺 | Australia | 4.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/australia` |
| 🇦🇹 | Austria | 2.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/austria` |
| 🇦🇿 | Azerbaijan | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/azerbaijan` |
| 🇧🇸 | Bahamas | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bahamas` |
| 🇧🇭 | Bahrain | 1.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bahrain` |
| 🇧🇩 | Bangladesh | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bangladesh` |
| 🇧🇾 | Belarus | 2.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/belarus` |
| 🇧🇪 | Belgium | 2.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/belgium` |
| 🇧🇿 | Belize | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/belize` |
| 🇧🇯 | Benin | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/benin` |
| 🇧🇹 | Bhutan | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bhutan` |
| 🇧🇴 | Bolivia | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bolivia` |
| 🇧🇦 | Bosnia and Herzegovina | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bosnia-herzegovina` |
| 🇧🇼 | Botswana | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/botswana` |
| 🇧🇷 | Brazil | 6.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/brazil` |
| 🇧🇳 | Brunei | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/brunei` |
| 🇧🇬 | Bulgaria | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/bulgaria` |
| 🇧🇫 | Burkina Faso | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/burkina-faso` |
| 🇧🇮 | Burundi | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/burundi` |
| 🇨🇻 | Cabo Verde | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cabo-verde` |
| 🇰🇭 | Cambodia | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cambodia` |
| 🇨🇲 | Cameroon | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cameroon` |
| 🇨🇦 | Canada | 16.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/canada` |
| 🇨🇫 | Central African Republic | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/central-african-republic` |
| 🇹🇩 | Chad | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/chad` |
| 🇨🇱 | Chile | 2.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/chile` |
| 🇨🇳 | China | 7.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/china` |
| 🇨🇴 | Colombia | 1.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/colombia` |
| 🇰🇲 | Comoros | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/comoros` |
| 🇨🇷 | Costa Rica | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/costa-rica` |
| 🇨🇮 | Côte d'Ivoire | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ivory-coast` |
| 🇭🇷 | Croatia | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/croatia` |
| 🇨🇾 | Cyprus | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/cyprus` |
| 🇨🇿 | Czech Republic | 2.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/czech-republic` |
| 🇩🇰 | Denmark | 1.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/denmark` |
| 🇩🇯 | Djibouti | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/djibouti` |
| 🇩🇴 | Dominican Republic | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/dominican-republic` |
| 🇨🇩 | DR Congo | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/dr-congo` |
| 🇪🇨 | Ecuador | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ecuador` |
| 🇪🇬 | Egypt | 2.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/egypt` |
| 🇸🇻 | El Salvador | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/el-salvador` |
| 🇬🇶 | Equatorial Guinea | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/equatorial-guinea` |
| 🇪🇷 | Eritrea | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/eritrea` |
| 🇪🇪 | Estonia | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/estonia` |
| 🇸🇿 | Eswatini | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/eswatini` |
| 🇪🇹 | Ethiopia | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ethiopia` |
| 🇫🇯 | Fiji | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/fiji` |
| 🇫🇮 | Finland | 2.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/finland` |
| 🇫🇷 | France | 12.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/france` |
| 🇬🇦 | Gabon | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/gabon` |
| 🇬🇲 | Gambia | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/gambia` |
| 🇬🇪 | Georgia | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/georgia` |
| 🇩🇪 | Germany | 14.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/germany` |
| 🇬🇭 | Ghana | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ghana` |
| 🇬🇷 | Greece | 1.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/greece` |
| 🇬🇹 | Guatemala | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/guatemala` |
| 🇬🇳 | Guinea | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/guinea` |
| 🇬🇼 | Guinea-Bissau | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/guinea-bissau` |
| 🇬🇾 | Guyana | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/guyana` |
| 🇭🇹 | Haiti | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/haiti` |
| 🇭🇳 | Honduras | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/honduras` |
| 🇭🇺 | Hungary | 1.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/hungary` |
| 🇮🇸 | Iceland | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/iceland` |
| 🇮🇳 | India | 4.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/india` |
| 🇮🇩 | Indonesia | 2.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/indonesia` |
| 🇮🇶 | Iraq | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/iraq` |
| 🇮🇪 | Ireland | 1.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ireland` |
| 🇮🇱 | Israel | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/israel` |
| 🇮🇹 | Italy | 5.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/italy` |
| 🇯🇲 | Jamaica | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/jamaica` |
| 🇯🇵 | Japan | 5.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/japan` |
| 🇯🇴 | Jordan | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/jordan` |
| 🇰🇿 | Kazakhstan | 1.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/kazakhstan` |
| 🇰🇪 | Kenya | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/kenya` |
| 🇰🇮 | Kiribati | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/kiribati` |
| 🇰🇼 | Kuwait | 1.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/kuwait` |
| 🇰🇬 | Kyrgyzstan | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/kyrgyzstan` |
| 🇱🇦 | Laos | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/laos` |
| 🇱🇻 | Latvia | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/latvia` |
| 🇱🇧 | Lebanon | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/lebanon` |
| 🇱🇸 | Lesotho | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/lesotho` |
| 🇱🇷 | Liberia | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/liberia` |
| 🇱🇾 | Libya | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/libya` |
| 🇱🇮 | Liechtenstein | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/liechtenstein` |
| 🇱🇹 | Lithuania | 1.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/lithuania` |
| 🇱🇺 | Luxembourg | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/luxembourg` |
| 🇲🇬 | Madagascar | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/madagascar` |
| 🇲🇼 | Malawi | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/malawi` |
| 🇲🇾 | Malaysia | 1.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/malaysia` |
| 🇲🇻 | Maldives | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/maldives` |
| 🇲🇱 | Mali | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mali` |
| 🇲🇹 | Malta | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/malta` |
| 🇲🇭 | Marshall Islands | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/marshall-islands` |
| 🇲🇷 | Mauritania | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mauritania` |
| 🇲🇺 | Mauritius | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mauritius` |
| 🇲🇽 | Mexico | 3.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mexico` |
| 🇫🇲 | Micronesia | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/micronesia` |
| 🇲🇩 | Moldova | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/moldova` |
| 🇲🇨 | Monaco | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/monaco` |
| 🇲🇳 | Mongolia | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mongolia` |
| 🇲🇪 | Montenegro | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/montenegro` |
| 🇲🇦 | Morocco | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/morocco` |
| 🇲🇿 | Mozambique | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/mozambique` |
| 🇳🇦 | Namibia | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/namibia` |
| 🇳🇷 | Nauru | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/nauru` |
| 🇳🇵 | Nepal | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/nepal` |
| 🇳🇱 | Netherlands | 4.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/netherlands` |
| 🇳🇿 | New Zealand | 2.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/new-zealand` |
| 🇳🇮 | Nicaragua | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/nicaragua` |
| 🇳🇪 | Niger | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/niger` |
| 🇳🇬 | Nigeria | 1.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/nigeria` |
| 🇲🇰 | North Macedonia | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/north-macedonia` |
| 🇳🇴 | Norway | 3.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/norway` |
| 🇴🇲 | Oman | 1.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/oman` |
| 🇵🇰 | Pakistan | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/pakistan` |
| 🇵🇼 | Palau | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/palau` |
| 🇵🇦 | Panama | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/panama` |
| 🇵🇬 | Papua New Guinea | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/papua-new-guinea` |
| 🇵🇾 | Paraguay | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/paraguay` |
| 🇵🇪 | Peru | 1.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/peru` |
| 🇵🇭 | Philippines | 1.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/philippines` |
| 🇵🇱 | Poland | 7.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/poland` |
| 🇵🇹 | Portugal | 1.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/portugal` |
| 🇶🇦 | Qatar | 1.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/qatar` |
| 🇨🇬 | Republic of the Congo | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/congo` |
| 🇷🇴 | Romania | 1.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/romania` |
| 🇷🇺 | Russia | 15.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/russia` |
| 🇷🇼 | Rwanda | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/rwanda` |
| 🇼🇸 | Samoa | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/samoa` |
| 🇸🇹 | São Tomé and Príncipe | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/sao-tome-and-principe` |
| 🇸🇦 | Saudi Arabia | 1.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/saudi-arabia` |
| 🇸🇳 | Senegal | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/senegal` |
| 🇷🇸 | Serbia | 1.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/serbia` |
| 🇸🇨 | Seychelles | 0.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/seychelles` |
| 🇸🇱 | Sierra Leone | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/sierra-leone` |
| 🇸🇬 | Singapore | 0.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/singapore` |
| 🇸🇰 | Slovakia | 1.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/slovakia` |
| 🇸🇮 | Slovenia | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/slovenia` |
| 🇸🇧 | Solomon Islands | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/solomon-islands` |
| 🇸🇴 | Somalia | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/somalia` |
| 🇿🇦 | South Africa | 1.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/south-africa` |
| 🇰🇷 | South Korea | 1.9 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/south-korea` |
| 🇸🇸 | South Sudan | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/south-sudan` |
| 🇪🇸 | Spain | 4.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/spain` |
| 🇱🇰 | Sri Lanka | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/sri-lanka` |
| 🇸🇩 | Sudan | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/sudan` |
| 🇸🇷 | Suriname | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/suriname` |
| 🇸🇪 | Sweden | 3.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/sweden` |
| 🇨🇭 | Switzerland | 2.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/switzerland` |
| 🇹🇯 | Tajikistan | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/tajikistan` |
| 🇹🇿 | Tanzania | 1.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/tanzania` |
| 🇹🇭 | Thailand | 1.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/thailand` |
| 🇹🇱 | Timor-Leste | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/east-timor` |
| 🇹🇬 | Togo | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/togo` |
| 🇹🇴 | Tonga | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/tonga` |
| 🇹🇳 | Tunisia | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/tunisia` |
| 🇹🇷 | Turkey | 2.0 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/turkey` |
| 🇹🇲 | Turkmenistan | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/turkmenistan` |
| 🇹🇻 | Tuvalu | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/tuvalu` |
| 🇺🇬 | Uganda | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/uganda` |
| 🇺🇦 | Ukraine | 3.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/ukraine` |
| 🇦🇪 | United Arab Emirates | 1.1 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/united-arab-emirates` |
| 🇬🇧 | United Kingdom | 7.3 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/united-kingdom` |
| 🇺🇾 | Uruguay | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/uruguay` |
| 🇺🇿 | Uzbekistan | 0.8 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/uzbekistan` |
| 🇻🇺 | Vanuatu | 0.4 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/vanuatu` |
| 🇻🇪 | Venezuela | 0.7 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/venezuela` |
| 🇻🇳 | Vietnam | 1.2 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/vietnam` |
| 🇿🇲 | Zambia | 0.6 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/zambia` |
| 🇿🇼 | Zimbabwe | 0.5 GB | `docker run -p 4326:4326 ghcr.io/roma8ok/getmapstack/zimbabwe` |

## What you get

All three engines serve their full API, not a trimmed subset - see [Not included](#not-included)
for the handful of features these images don't have the data to answer. Everything below
runs against a plain `docker run` of a country image, with no configuration.

| Task | Request | Service |
|------|---------|---------|
| Route between two or more points | [`POST /route`](#route) | `/valhalla` |
| Route for a given departure or arrival time | [`POST /route`](#time-dependent-route) | `/valhalla` |
| Visit many stops in the best order | [`POST /optimized_route`](#optimized-route) | `/valhalla` |
| Time and distance for many pairs at once | [`POST /sources_to_targets`](#time-and-distance-matrix) | `/valhalla` |
| Area reachable within N minutes | [`POST /isochrone`](#isochrone) | `/valhalla` |
| Meeting point for several starting points | [`POST /centroid`](#meeting-point) | `/valhalla` |
| Snap a GPS track to the road network | [`POST /trace_route`](#map-matching) | `/valhalla` |
| Per-segment attributes of a snapped track | [`POST /trace_attributes`](#map-matching) | `/valhalla` |
| Inspect what the router explored | [`POST /expansion`](#expansion) | `/valhalla` |
| Nearest road to a coordinate | [`POST /locate`](#locate) | `/valhalla` |
| Road network as vector tiles | [`POST /tile`](#road-network-tiles) | `/valhalla` |
| Coordinates from a place name, search and autocomplete | [`GET /api?q=`](#search) | `/photon` |
| Coordinates from address fields | [`GET /structured`](#structured-search) | `/photon` |
| Address from coordinates | [`GET /reverse`](#reverse-geocoding) | `/photon` |
| Vector basemap tiles for any map library | [`GET /basemap/{z}/{x}/{y}`](#vector-tiles) | `/martin` |
| Map style, fonts, icons | [`GET /style/bright`, `/font/...`, `/sprite/...`](#fonts-and-icons) | `/martin` |
| Static map images, no JS | [`GET/POST /style/bright/static/...`](#static-images) | `/martin` |
| Rendered raster tiles | [`GET /style/bright/{z}/{x}/{y}.png`](#rendered-raster-tiles) | `/martin` |
| Live PostGIS overlay | [`MARTIN_POSTGRES` env](#live-postgis-overlay) | `/martin` |
| Versions and how old the data is | [`GET /status`](#data-freshness) | `/valhalla`, `/photon` |
| Liveness check for the map service | [`GET /health`](#data-freshness) | `/martin` |
| Whether the container is ready to serve | [`GET /healthz`](#data-freshness) | the container |
| Which country this image carries | [`GET /countries.json`](#data-freshness) | the container |

Parameter-level reference for all three:
[Valhalla API](https://valhalla.github.io/valhalla/api/turn-by-turn/api-reference/) ·
[Photon API](https://github.com/komoot/photon/blob/master/docs/api-v1.md) ·
[Martin docs](https://maplibre.org/martin/)

### Routing

#### Route

Cost options shape the result. This one avoids highways and tolls, asks for two
alternatives and kilometers:

```bash
curl localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "costing_options":{"auto":{"use_highways":0.2,"use_tolls":0}},
  "units":"kilometers",
  "alternates":2
}'
```

```json
{"trip":{"summary":{"length":90.545,"time":5700.343,"has_highway":false}},"alternates":[...]}
```

The default car route between the same points is 84.7 km in 63 minutes over the highway;
avoiding it costs 5.8 km and 32 minutes.

Costing profiles: `auto`, `bicycle`, `pedestrian`, `truck`, `motorcycle`, `bus`, `taxi`,
`motor_scooter`. Truck costing takes vehicle dimensions:

```bash
curl localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"truck",
  "costing_options":{"truck":{"height":4.11,"weight":21.77,"axle_load":9.07}}
}'
```

To route around an area, pass `exclude_polygons` - all polygons in one request may total
at most 10 km of perimeter, summed across every polygon rather than measured per polygon.
Each vertex is a `[lon, lat]` pair, the reverse of the `lat`/`lon` keys `locations` uses
in the same request:

```bash
curl localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "exclude_polygons":[[[33.36,35.15],[33.38,35.15],[33.38,35.17],[33.36,35.17],[33.36,35.15]]]
}'
```

```json
{"trip":{"summary":{"length":88.282,"time":4004.178}}}
```

**Decoding the shape:** every leg carries `shape` as an encoded polyline at **precision
6**, while Google's algorithm and most off-the-shelf decoders default to precision 5.
Decoded at precision 5, the route lands roughly ten times away from where it belongs.
Use a precision-6 decoder, or ask for GeoJSON instead:

```bash
curl localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "shape_format":"geojson"
}'
```

#### Time-dependent route

`date_time` accepts `type: 0` for "depart now", `type: 1` for "depart at", `type: 2`
for "arrive by", and `type: 3` for "invariant" - the clock does not advance along the
route, so every road is evaluated at the same moment. The answer carries local times
and time zones per location:

```bash
curl localhost:4326/valhalla/route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto",
  "date_time":{"type":1,"value":"2026-08-03T08:00"}
}'
```

```json
{"trip":{"locations":[
  {"lat":35.1856,"lon":33.3823,"date_time":"2026-08-03T08:00","time_zone_offset":"+03:00","time_zone_name":"Asia/Nicosia"},
  {"lat":34.6786,"lon":33.0413,"date_time":"2026-08-03T09:01","time_zone_offset":"+03:00","time_zone_name":"Asia/Nicosia"}]}}
```

Departure time picks up time-of-day access restrictions and daylight-saving arithmetic,
including routes that cross a time zone. It does not change travel speeds: the images
carry no traffic data, so travel time is the same at rush hour and at night.

#### Optimized route

Reorders the stops between the first and the last to make the trip shortest. Nicosia,
Paphos, Larnaca, Limassol in that order is 350.4 km:

```bash
curl localhost:4326/valhalla/optimized_route -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.7754,"lon":32.4245},
               {"lat":34.9229,"lon":33.6233},{"lat":34.6786,"lon":33.0413}],
  "costing":"auto"
}'
```

```json
{"trip":{"summary":{"length":249.218},"locations":[{"original_index":0},{"original_index":2},{"original_index":1},{"original_index":3}]}}
```

`original_index` maps each stop back to its position in the request - here the optimizer
saved 101 km.

#### Time and distance matrix

Travel time and distance for every source-target pair, in one request:

```bash
curl localhost:4326/valhalla/sources_to_targets -d '{
  "sources":[{"lat":35.1856,"lon":33.3823}],
  "targets":[{"lat":34.9229,"lon":33.6233},{"lat":35.0333,"lon":33.2000}],
  "costing":"auto"
}'
```

```json
{"sources_to_targets":[[{"from_index":0,"to_index":0,"time":2259,"distance":47.447},
                        {"from_index":0,"to_index":1,"time":3975,"distance":32.935}]]}
```

Keep the pairs regional: distant pairs come back with `null` time and distance even
though a direct route request between the same points succeeds.

#### Isochrone

How far you get in 10 and 20 minutes by car, as polygons:

```bash
curl localhost:4326/valhalla/isochrone -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "contours":[{"time":10,"color":"ff0000"},{"time":20,"color":"0000ff"}],
  "polygons":true,
  "denoise":0.5,
  "generalize":50
}'
```

```json
{"type":"FeatureCollection","features":[{"properties":{"contour":20.0,"metric":"time","color":"#0000ff"},"geometry":{"type":"Polygon","coordinates":[...]}}]}
```

Drop the coordinates straight into any map library. Contours can be distances instead of
times (`{"distance":1.5}`). Limits: up to 4 contours, 120 minutes or 200 km per contour,
one location per request.

#### Meeting point

Where several people should meet, by travel time rather than by geometry:

```bash
curl localhost:4326/valhalla/centroid -d '{
  "locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.6786,"lon":33.0413},{"lat":34.9229,"lon":33.6233}],
  "costing":"auto"
}'
```

```json
{"trip":{"locations":[{"lat":35.1856,"lon":33.3823},{"lat":34.83793,"lon":33.40012}],"summary":{"length":42.461,"time":929.531}}}
```

With three input stops, the top-level `trip` only carries the route from the first stop
(`trip.locations[0]`) to the converging point (`trip.locations[1]`). The routes from the
other input stops to that same point come back as full route objects - each with its own
`trip.locations` and `summary` - in the `alternates` array, one per remaining stop in
input order.

#### Map matching

Snap a raw GPS trace onto the road network and get a normal route back:

```bash
curl localhost:4326/valhalla/trace_route -d '{
  "shape":[{"lat":35.1856,"lon":33.3823},{"lat":35.1860,"lon":33.3830},
           {"lat":35.1869,"lon":33.3841},{"lat":35.1880,"lon":33.3855}],
  "costing":"auto",
  "shape_match":"map_snap"
}'
```

```json
{"trip":{"summary":{"length":0.584,"time":79.172},"legs":[{"maneuvers":[{"street_names":["Agiou Dimitriou"]}]}]}}
```

`/trace_attributes` returns the matched road segments instead of driving instructions,
and `filters` keeps the response to the attributes you asked for:

```bash
curl localhost:4326/valhalla/trace_attributes -d '{
  "shape":[{"lat":35.1856,"lon":33.3823},{"lat":35.1860,"lon":33.3830},
           {"lat":35.1869,"lon":33.3841},{"lat":35.1880,"lon":33.3855}],
  "costing":"auto",
  "shape_match":"map_snap",
  "filters":{"attributes":["edge.names","edge.speed","edge.road_class","edge.length"],"action":"include"}
}'
```

```json
{"edges":[{"names":["Agiou Dimitriou"],"speed":30,"road_class":"residential","length":0.039},
          {"names":["Plapouta"],"speed":30,"road_class":"residential","length":0.007}]}
```

#### Expansion

The search tree the router walked, as GeoJSON - useful for debugging a surprising route
or visualizing reachability:

```bash
curl localhost:4326/valhalla/expansion -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "action":"isochrone",
  "contours":[{"time":1}],
  "expansion_properties":["edge_id","cost","distance","edge_status"]
}'
```

```json
{"type":"FeatureCollection","properties":{"algorithm":"dijkstras"},
 "features":[{"properties":{"distance":161,"cost":21,"edge_status":"s","edge_id":3473392795306}}]}
```

`action` can also be `route`; expect a large response, since it contains every edge the
search touched.

#### Locate

What road a coordinate belongs to:

```bash
curl localhost:4326/valhalla/locate -d '{
  "locations":[{"lat":35.1856,"lon":33.3823}],
  "costing":"auto",
  "verbose":true
}'
```

```json
[{"input_lat":35.1856,"input_lon":33.3823,"edges":[{"edge_info":{"names":["Zappeiou"],"way_id":21056849,"speed_limit":0}}]}]
```

`speed_limit` is 0 where OSM carries no `maxspeed` tag - routing still uses the profile's
default speed for that road class.

#### Road network tiles

The routing graph itself, as Mapbox Vector Tiles - layers `edges`, `nodes`, `shortcuts`
and `access_restrictions`, with per-edge attributes like road class and speed. Not a
basemap: no buildings, land use or labels, just every road the router knows about. The
tile address goes in a nested `tile` object; the common `/z/x/y.mvt` path form is not
supported:

```bash
curl localhost:4326/valhalla/tile -d '{"tile":{"z":14,"x":9711,"y":6479}}' -o nicosia.mvt
```

The same request as a GET with URL-encoded JSON works as a tile template - point
MapLibre at it and the road network renders like any vector source:

```js
sources: {
  valhalla: {
    type: "vector",
    tiles: ["http://localhost:4326/valhalla/tile?json=%7B%22tile%22%3A%7B%22z%22%3A{z}%2C%22x%22%3A{x}%2C%22y%22%3A{y}%7D%7D"],
    minzoom: 7
  }
}
```

Style the `edges` source-layer to see the network. Low zoom levels carry only the bigger
road classes; the endpoint is marked beta upstream. For a real basemap with buildings,
land use, water and labels, see [Map](#map).

### Geocoding

#### Search

Place name to coordinates. `lang` picks the language of the returned names:

```bash
curl "localhost:4326/photon/api?q=Nicosia&limit=1&lang=en"
```

```json
{"features":[{"geometry":{"type":"Point","coordinates":[33.3638783,35.1746503]},
  "properties":{"name":"Nicosia","type":"district","country":"Cyprus","state":"Cyprus"}}]}
```

Without `lang` the same query returns local names - `Λευκωσία - Lefkoşa`, `Κύπρος -
Kıbrıs`.

The index is built for prefix matching, so autocomplete is the same endpoint with a
partial query:

```bash
curl "localhost:4326/photon/api?q=Limas&limit=5&lang=en"
```

```json
{"features":[{"properties":{"name":"Limassol","type":"district"}},
             {"properties":{"name":"Limassol District","type":"county"}},
             {"properties":{"name":"Limassol","type":"city"}},
             {"properties":{"name":"Limassol Medieval Castle","type":"house"}},
             {"properties":{"name":"Limassol Salt Lake","type":"other"}}]}
```

Narrow the results by proximity, by bounding box, by result layer, by country, or by
OSM tag - `bbox` takes `minLon,minLat,maxLon,maxLat`, the reverse order of the
`lat`/`lon` query parameters on the same endpoint:

```bash
curl "localhost:4326/photon/api?q=Agios&limit=3&lat=34.6786&lon=33.0413&lang=en"
curl "localhost:4326/photon/api?q=Agios&limit=3&bbox=32.9,34.6,33.2,34.8&lang=en"
curl "localhost:4326/photon/api?q=Larnaca&limit=3&layer=city&lang=en"
curl "localhost:4326/photon/api?q=Nicosia&limit=3&countrycode=CY&lang=en"
curl "localhost:4326/photon/api?q=hospital&limit=3&osm_tag=amenity:hospital&lang=en"
```

The last one turns the geocoder into a POI search:

```json
{"features":[{"properties":{"name":"Nicosia General Hospital","osm_value":"hospital","city":"Apostolos Varnavas & Agios Makarios"}},
             {"properties":{"name":"Paphos General Hospital","osm_value":"hospital","city":"Paphos"}},
             {"properties":{"name":"Lito Private Hospital","osm_value":"hospital","city":"Paralimni"}}]}
```

A few more dials: `zoom` and `location_bias_scale` tune how strongly the `lat`/`lon`
bias pulls results toward the focus point, `dedupe=0` keeps near-duplicate entries the
geocoder would otherwise fold, and `include`/`exclude` filter by category
(`osm.<key>.<value>`). A category with no `q` at all is pure discovery - everything of
one kind near a point:

```bash
curl "localhost:4326/photon/api?include=osm.amenity.hospital&limit=3&lat=35.1856&lon=33.3823&lang=en"
```

#### Structured search

When the address already comes split into fields - a checkout form, a CRM record - skip
free-text guessing and pass the fields directly. Any subset of `street`, `housenumber`,
`city`, `district`, `county`, `state`, `postcode` and `countrycode` works:

```bash
curl "localhost:4326/photon/structured?street=Zappeiou&housenumber=21&city=Nicosia&lang=en"
```

```json
{"features":[{"geometry":{"type":"Point","coordinates":[33.3824628,35.1852708]},
  "properties":{"housenumber":"21","street":"Zappeiou","city":"Nicosia","postcode":"1036","type":"house"}}]}
```

At least one field is required, and `q` is not accepted here - free text and structured
fields cannot mix in one request.

#### Reverse geocoding

Coordinates to address:

```bash
curl "localhost:4326/photon/reverse?lat=35.1853&lon=33.3825&limit=1"
```

```json
{"features":[{"properties":{"street":"Zappeiou","housenumber":"21","city":"Λευκωσία","postcode":"1036"}}]}
```

`radius` (km) widens the search, `layer` restricts what comes back - streets only, for
example:

```bash
curl "localhost:4326/photon/reverse?lat=35.1853&lon=33.3825&radius=5&limit=3&layer=street&lang=en"
```

```json
{"features":[{"properties":{"name":"Perikleous","type":"street"}},
             {"properties":{"name":"Zappeiou","type":"street"}},
             {"properties":{"name":"Gianni Tsiatala","type":"street"}}]}
```

Buildings come back without a `name` - they carry `housenumber` and `street` instead, so
check the number of features rather than the presence of a name.

### Map

Martin serves a full vector basemap built by Planetiler from the same OSM snapshot as
routing and geocoding - tiles, fonts, icons, a ready-to-use style, static map images and
rendered raster tiles, all under `/martin`. Any map rendered from these tiles must show
visible credit: `(c) OpenMapTiles (c) OpenStreetMap contributors`. The tileset carries that
string in its TileJSON, so a MapLibre map built on the shipped style displays it on its own.
Static images and rendered raster tiles come back as bare pixels - whatever page or
document they land in has to carry the credit.

The shipped style is [OpenFreeMap Bright](https://github.com/hyperknot/openfreemap-styles),
a maintained fork of OSM Bright, vendored here with five edits and the icons that come with
it; `make update-bright-style` diffs the vendored copy against upstream. The tiles follow
the OpenMapTiles schema, so any style written for that schema works instead - point a client
at your own and serve it from wherever you like.

#### Vector tiles

TileJSON describes the tileset; `/basemap/{z}/{x}/{y}` serves the tiles themselves:

```bash
curl localhost:4326/martin/basemap
```

```json
{"tiles":["http://localhost:4326/martin/basemap/{z}/{x}/{y}"],"name":"OpenMapTiles","attribution":"<a href=\"https://www.openmaptiles.org/\" target=\"_blank\">&copy; OpenMapTiles</a> <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">&copy; OpenStreetMap contributors</a>","bounds":[31.95244,34.2337399,34.96147,36.00323],"minzoom":0,"maxzoom":14}
```

Point MapLibre GL JS at the ready-made style instead of wiring up sources by hand:

```js
import maplibregl from "maplibre-gl";

new maplibregl.Map({
  container: "map",
  style: "http://localhost:4326/martin/style/bright",
  center: [33.3823, 35.1856],
  zoom: 12
});
```

#### Fonts and icons

`/font/{fontstack}/{range}` cuts glyph PBFs on the fly for whatever text a style's layers
need - `curl "localhost:4326/martin/font/Noto%20Sans%20Regular/0-255"` (URL-encode the space in
the fontstack name). `/sprite/bright.png` and
`/sprite/bright.json` (plus `@2x` and an `sdf_sprite/` variant for tintable icons) serve
the icon images the style's point layers reference.

#### Static images

Render a PNG or JPEG server-side, no browser or JavaScript involved - point, zoom and
size go in the path:

```bash
curl "localhost:4326/martin/style/bright/static/33.3823,35.1856,13/600x400.png" -o map.png
```

POST a GeoJSON `FeatureCollection` to draw markers, lines or polygons on top of the same
view:

```bash
curl -X POST "localhost:4326/martin/style/bright/static/33.3823,35.1856,13/600x400.png" \
  -H "Content-Type: application/json" \
  -d '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[33.3823,35.1856]},"properties":{"circle-radius":8,"circle-color":"#e11"}}]}' \
  -o map-overlay.png
```

Both come back as a 600x400 PNG - the second one with a red dot over Nicosia.

#### Rendered raster tiles

The same style pre-rendered into ordinary `{z}/{x}/{y}.png` raster tiles, for clients
that don't speak vector tiles:

```bash
curl "localhost:4326/martin/style/bright/12/2427/1619.png" -o tile.png
```

#### Serving to another host

The style's tile/glyph/sprite URLs default to `http://localhost:4326/martin` - fine
inside a single container, wrong once a browser on another machine needs to fetch them.
Set `PUBLIC_URL` to the martin-prefixed address a browser can reach, and the entrypoint
templates it into the style at startup:

```bash
docker run -p 4326:4326 \
  -e PUBLIC_URL=https://maps.example.com/martin \
  ghcr.io/roma8ok/getmapstack/cyprus
```

Static images and rendered raster tiles are drawn by Martin inside the container, which
often cannot reach `PUBLIC_URL` itself - a public hostname, a certificate, a firewall in
the way. It does not have to: a render request under `/style/bright/...` is served from an
internal copy of the style whose URLs never leave the container, whatever `PUBLIC_URL` is
set to. One style id, `bright`, for browsers and for rendering alike.

#### Live PostGIS overlay

Set `MARTIN_POSTGRES` to a Postgres connection string and Martin adds every table with a
geometry column as an extra tile source at `/{table}/{z}/{x}/{y}`, auto-discovered, no
config file to edit:

```yaml
environment:
  MARTIN_POSTGRES: postgres://user:password@host:5432/dbname
```

Leave it unset and the map stays fully static - no database, no extra moving part.

### Data freshness

The routing and geocoding engines report their version and when their data was built:

```bash
curl localhost:4326/valhalla/status
```

```json
{"version":"3.8.3","tileset_last_modified":1785100041,"available_actions":[...]}
```

```bash
curl localhost:4326/photon/status
```

```json
{"status":"Ok","import_date":"2026-07-25T18:00:19Z","version":"1.2.1","git_commit":"b9d6ab92"}
```

Both timestamps are build times, not the OpenStreetMap snapshot date. Every published
image also carries a date tag matching the OSM extract it was built from, next to
`latest`. The vector tileset carries the same snapshot: all three services build from one
pinned OSM download.

The map service answers `curl localhost:4326/martin/health` with `OK` - a liveness check, no
version or build date. The tileset's own metadata sits in its
[TileJSON](#vector-tiles) instead.

One probe covers the whole container: `curl localhost:4326/healthz` returns
`{"status":"ok"}` once routing, geocoding and tiles all answer, and HTTP 503 with
`{"error":"upstream unavailable","status":503}` while any of them is still opening its data
or has died. That is the probe to give a load balancer or an orchestrator, and the one the
image's own healthcheck runs. The verdict is cached for about five seconds, so polling it
costs the engines nothing.

An image also names what it carries: `curl localhost:4326/countries.json` returns
`{"countries":["cyprus"]}`. The explorer reads it to label itself, and it is the cheap way
for anything pointed at an unknown container to find out which country answers there.

### Environment variables

Everything the container publishes arrives through one process, and these are its knobs.
All have working defaults - a plain `docker run` needs none of them.

| Variable | Default | What it does |
|----------|---------|--------------|
| `GMS_LISTEN` | `:4326` | Address inside the container. `-p 8080:4326` is the usual way to change the port you connect to; this changes the one the container itself binds. |
| `GMS_MAX_BODY_BYTES` | `10485760` | Largest request body accepted, in bytes; over it, HTTP 413. Raise it for very long GPS traces posted to `/valhalla/trace_attributes`. The time a client is given to upload a body scales with this value, so a bigger limit is also a longer upload window. |
| `GMS_UPSTREAM_TIMEOUT` | `60s` | How long an engine has to answer before the request fails with HTTP 504. Any Go duration (`90s`, `2m`). |
| `GMS_EXPLORER_ROOT` | `/data/explorer` | Directory served at `/`. Mount your own page over it, or point this elsewhere, to replace the explorer. |

Two more configure the map service specifically: `PUBLIC_URL`
([serving to another host](#serving-to-another-host)) and `MARTIN_POSTGRES`
([live PostGIS overlay](#live-postgis-overlay)).

### Not included

- **Elevation.** Tiles are built without elevation data: `/height` answers with `null`
  values and routes carry no grade. Adding it means changing how the tiles are built and
  supplying a separate elevation dataset - it is not a flag on these images.
- **Traffic.** No live or historical traffic. Travel times use free-flow speeds, so a
  route takes the same time at 08:00 and at 23:00.
- **Public transport.** No GTFS feed is imported. `costing: multimodal` fails with
  "Locations are in unconnected regions" rather than falling back to walking, and
  `/transit_available` always answers `false`.
- **Full geometries.** The geocoding index stores points only: `geometry=1` answers
  HTTP 400. Area features still carry an `extent` bounding box where OSM has one.
- **One country per image.** A route that leaves the country in the image has no data to
  follow - run the image for the country you need, or run several.

## Build it yourself

Requires Docker. Build a country image locally instead of pulling from GHCR:

```bash
git clone https://github.com/roma8ok/getmapstack.git
cd getmapstack
make build-valhalla-builder
make build-photon-builder
make build-planetiler-builder
make fetch-osm COUNTRY=cyprus
make create-valhalla-tiles COUNTRY=cyprus
make create-photon-data COUNTRY=cyprus
make create-vector-tiles COUNTRY=cyprus
make build-server COUNTRY=cyprus
docker run -p 4326:4326 getmapstack/cyprus
```

`fetch-osm` pins one OSM snapshot so all three builders work from the same download. Intermediate artifacts (routing tiles, geocoding index, vector tiles) land in `artifacts/`. `make clean-artifacts` lists what can be reclaimed there and deletes it with `CONFIRM=1`, leaving the OSM download cache in place. Images build for linux/amd64 and linux/arm64 by default - pass `PLATFORMS=linux/arm64` (or your platform) for a faster single-arch build. `make help` lists all targets and available countries.

## License

Code: [MIT](LICENSE). Map data: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), sourced from [Geofabrik](https://download.geofabrik.de/) extracts.

The images embed OSM-derived databases (routing tiles, geocoding index, vector tiles) redistributed under ODbL 1.0 - see [NOTICE](NOTICE) for full attribution. If you publicly use routing or geocoding results from these images, credit OpenStreetMap: "© OpenStreetMap contributors" linked to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).

The basemap adds third-party design work: the tiles follow the [OpenMapTiles](https://openmaptiles.org/) schema (CC-BY 4.0), the style is [OpenFreeMap Bright](https://github.com/hyperknot/openfreemap-styles) - a fork of OpenMapTiles' OSM Bright, style code BSD-3-Clause, style design CC-BY 4.0, the fork's own changes MIT - with [Maki](https://github.com/mapbox/maki) icons under CC0 1.0 and [Noto](https://github.com/notofonts) fonts under OFL 1.1. Full license texts ship inside every image at `/usr/share/doc/getmapstack/THIRD_PARTY_LICENSES`.

The demo in `demo/isochrone-wave/` carries a verbatim copy of the Dark style from that same project (`src/styles/dark.json`) under those same terms, adapted at runtime rather than edited. Maps drawn from these tiles must show visible credit: "© OpenMapTiles © OpenStreetMap contributors".
