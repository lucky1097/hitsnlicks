// Static game content for the prototype: items, missions, bosses, map placements.
// Map coordinates are in map pixels (map is 896 x 640, one tile = 16 px).

export const SLOTS = [
  { id: 'zbran', name: 'Zbraň' },
  { id: 'bunda', name: 'Bunda' },
  { id: 'nohavice', name: 'Nohavice' },
  { id: 'topanky', name: 'Topánky' },
  { id: 'retiazka', name: 'Retiazka' },
  { id: 'prsten', name: 'Prsteň' },
  { id: 'hodinky', name: 'Hodinky' },
  { id: 'auto', name: 'Auto' },
];

// kind 'dmg' adds weapon damage; otherwise `stats` maps stat -> share of item power.
// rarity: the item always has this rarity (weapons) — bežné v obchodoch, epické len na Čiernom trhu,
// legendárne len z bossov (1 %). legacy: kept only so old saves still load; never sold or dropped.
export const ITEM_BASES = {
  // attack: how the weapon works in the city — 'melee' slashes in front, 'gun' shoots forward
  // (cooldown in seconds, auto = keeps firing while held)
  bat: { slot: 'zbran', name: 'Hliníková pálka', art: 'w_bat', kind: 'dmg', mult: 0.95, rarity: 'bezny', attack: 'melee', cooldown: 0.5 },
  knuckles: { slot: 'zbran', name: 'Boxer', art: 'w_knuckles', kind: 'dmg', mult: 0.9, rarity: 'bezny', attack: 'melee', cooldown: 0.3 },
  knife: { slot: 'zbran', name: 'Bojový nôž', art: 'w_knife', kind: 'dmg', mult: 1.0, rarity: 'bezny', attack: 'melee', cooldown: 0.35 },
  machete: { slot: 'zbran', name: 'Mačeta', art: 'w_machete', kind: 'dmg', mult: 1.05, rarity: 'bezny', attack: 'melee', cooldown: 0.45 },
  glock: { slot: 'zbran', name: 'Malá deviatka', art: 'w_glock', kind: 'dmg', mult: 1.1, rarity: 'epicky', attack: 'gun', cooldown: 0.3 },
  gold1911: { slot: 'zbran', name: 'Zlatá 1911', art: 'w_gold1911', kind: 'dmg', mult: 1.2, rarity: 'legendarny', attack: 'gun', cooldown: 0.28 },
  katana: { slot: 'zbran', name: 'Katana', art: 'w_katana', kind: 'dmg', mult: 1.15, rarity: 'epicky', attack: 'melee', cooldown: 0.4 },
  kalach: { slot: 'zbran', name: 'Kalach', art: 'w_kalach', kind: 'dmg', mult: 1.2, rarity: 'epicky', attack: 'gun', cooldown: 0.14, auto: true },
  ak: { slot: 'zbran', name: 'Krátky kalach', art: 'w_ak', kind: 'dmg', mult: 1.3, rarity: 'legendarny', attack: 'gun', cooldown: 0.12, auto: true },
  pistol: { slot: 'zbran', name: 'Pištoľ', art: 'it_pistol', kind: 'dmg', mult: 1.1, legacy: true, attack: 'gun', cooldown: 0.3 },
  // jacket and pants give armor (share of damage stopped, see F.reduction)
  jacket: { slot: 'bunda', name: 'Kožená bunda', art: 'it_jacket', stats: { armor: 3 }, desc: 'Stará dobrá koža. Zažila viac bitiek ako ty a ešte drží.' },
  pants: { slot: 'nohavice', name: 'Čierne rifle', art: 'it_pants', stats: { armor: 2 } },
  // trousers: all common (blue background), sold in Oblečenie
  jeans_blue: { slot: 'nohavice', name: 'Modré rifle', art: 'x_jeans_blue', stats: { armor: 2 }, rarity: 'bezny', desc: 'Obyčajné rifle. Presne v takých ťa svedok nevie popísať.' },
  track_pants: { slot: 'nohavice', name: 'Šuštiaky', art: 'x_track_pants', stats: { armor: 2 }, rarity: 'bezny', desc: 'Šuchocú pri každom kroku. Na tiché vlámanie si vezmi niečo iné.' },
  cargo_olive: { slot: 'nohavice', name: 'Olivové kapsáče', art: 'x_cargo_olive', stats: { armor: 2 }, rarity: 'bezny', desc: 'Bočné vrecká na všetko, čo nemáš mať pri sebe. Šnúrky dole proti prievanu aj psom.' },
  carpenter_pants: { slot: 'nohavice', name: 'Robotnícke nohavice', art: 'x_carpenter_pants', stats: { armor: 2 }, rarity: 'bezny', desc: 'Dvojité kolená, lebo na kolenách sa tu často končí. Aj začína.' },
  cargo_camo: { slot: 'nohavice', name: 'Maskáčové kapsáče', art: 'x_cargo_camo', stats: { armor: 2 }, rarity: 'bezny', desc: 'Maskáč v meste nemaskuje nič. Ale vyzerá, že vieš, čo robíš.' },
  sweatpants: { slot: 'nohavice', name: 'Sivé tepláky', art: 'x_sweatpants', stats: { armor: 2 }, rarity: 'bezny', desc: 'Večierka o druhej ráno, výsluch o tretej. Pohodlné na oboje.' },
  jeans_ripped: { slot: 'nohavice', name: 'Roztrhané čierne rifle', art: 'x_jeans_ripped', stats: { armor: 2 }, rarity: 'bezny', desc: 'Diery na kolenách nie sú z módy. Sú z plota pri Starom moste.' },
  shorts_ball: { slot: 'nohavice', name: 'Basketbalové trenky', art: 'x_shorts_ball', stats: { armor: 2 }, rarity: 'bezny', desc: 'Fialovo-zlaté, dlhé po kolená. Na ihrisku za bytovkou sa v nich rozdávajú karty aj rany.' },
  cargo_compass: { slot: 'nohavice', name: 'Grafitové kapsáče s kompasom', art: 'x_cargo_compass', stats: { armor: 2 }, rarity: 'epicky', desc: 'Kompas na vrecku, aby si vždy trafil k Čiernemu trhu. Domov už nie.' },
  track_monogram: { slot: 'nohavice', name: 'Monogramové tepláky', art: 'x_track_monogram', stats: { armor: 2 }, rarity: 'epicky', desc: 'Zlaté písmená od pása po členky. Kto ich nosí, nemusí nikomu hovoriť, koľko zarobil.' },
  jeans_biker: { slot: 'nohavice', name: 'Rozbité rifle s chráničmi', art: 'x_jeans_biker', stats: { armor: 2 }, rarity: 'epicky', desc: 'Diery stoja viac ako celé nohavice v obchode. Čierne chrániče sú tam pre prípad, že kľačíš pred niekým, kto ti dlží.' },
  leather_crosses: { slot: 'nohavice', name: 'Kožené nohavice so striebornými krížmi', art: 'x_leather_crosses', stats: { armor: 2 }, rarity: 'legendarny', desc: 'Šnurovanie po bokoch a strieborné kríže. Nosí ich ten, kto sa za hriechy nemodlí, ale platí. Vypadnú len z bossa.' },
  sneaker: { slot: 'topanky', name: 'Tenisky', art: 'it_sneaker', stats: { obratnost: 0.6 } },
  chain: { slot: 'retiazka', name: 'Retiazka', art: 'it_chain', stats: { charizma: 0.6 } },
  ring: { slot: 'prsten', name: 'Prsteň', art: 'it_ring', stats: { stastie: 0.6 } },
  watch: { slot: 'hodinky', name: 'Hodinky', art: 'it_watch', stats: { charizma: 0.3, stastie: 0.3 } },
  // illustrated pieces with a fixed rarity (art background: blue = common, pink = epic, gold / purple = legendary)
  jacket_puffer: { slot: 'bunda', name: 'Lesklá páperovka', art: 'x_jacket_puffer', stats: { armor: 3 }, rarity: 'epicky', desc: 'Lesk ako čerstvo navoskované auto. Na corneri ťa v nej spoznajú aj potme.' },
  // jackets: blue background = common (shops), pink = epic (Black Market), gold = legendary (bosses)
  puffer_red: { slot: 'bunda', name: 'Červená páperovka', art: 'x_puffer_red', stats: { armor: 3 }, rarity: 'bezny', desc: 'Teplá, lacná a vidno ju z druhého konca ulice. Na tiché akcie sa nehodí.' },
  varsity_gold: { slot: 'bunda', name: 'Klubová bunda so zlatými rukávmi', art: 'x_varsity_gold', stats: { armor: 3 }, rarity: 'bezny', desc: 'Z bazáru. Tím, za ktorý kedysi hrala, už dávno neexistuje. Ty áno.' },
  field_jacket: { slot: 'bunda', name: 'Poľná bunda', art: 'x_field_jacket', stats: { armor: 3 }, rarity: 'bezny', desc: 'Štyri vrecká a žiadne otázky. Vydrží dážď, blato aj policajný obušok.' },
  varsity_red: { slot: 'bunda', name: 'Školská bunda s H', art: 'x_varsity_red', stats: { armor: 3 }, rarity: 'bezny', desc: 'H ako Hits. Alebo Hustler. Alebo Hlupák, záleží, kto sa pýta.' },
  work_jacket: { slot: 'bunda', name: 'Robotnícka bunda', art: 'x_work_jacket', stats: { armor: 3 }, rarity: 'bezny', desc: 'Menčestrový golier a ošúchané lakte. Vyzeráš, že poctivo robíš. Nerobíš.' },
  bomber_olive: { slot: 'bunda', name: 'Olivová bomberka', art: 'x_bomber_olive', stats: { armor: 3 }, rarity: 'bezny', desc: 'Oranžová podšívka svieti ako výstražné svetlo. Ideálna na rýchle odchody.' },
  track_navy: { slot: 'bunda', name: 'Tepláková bunda', art: 'x_track_navy', stats: { armor: 3 }, rarity: 'bezny', desc: 'Tri pásiky, jeden zips a nulový rešpekt k dress codu.' },
  jacket_compass: { slot: 'bunda', name: 'Bunda s kompasom', art: 'x_jacket_compass', stats: { armor: 3 }, rarity: 'epicky', desc: 'Odznak s kompasom na rukáve. Ukazuje jediný smer, ktorý poznáš: preč od polície.' },
  parka_fur: { slot: 'bunda', name: 'Parka s kožušinou', art: 'x_parka_fur', stats: { armor: 3 }, rarity: 'epicky', desc: 'Kapucňa s kožušinou a štyri vrecká. Nikto nevie, čo v nich nosíš, a tak to má byť.' },
  puffer_hood: { slot: 'bunda', name: 'Čierna páperovka s kapucňou', art: 'x_puffer_hood', stats: { armor: 3 }, rarity: 'epicky', desc: 'Čierna a lesklá ako mokrý asfalt o tretej ráno. Zima ťa v nej nedostane. Konkurencia možno.' },
  biker_jacket: { slot: 'bunda', name: 'Motorkárska bunda', art: 'x_biker_jacket', stats: { armor: 3 }, rarity: 'bezny', desc: 'Šikmý zips, opasok a cvočky. Motorku nemáš, ale vyzeráš, že ťa niekde čaká.' },
  denim_jacket: { slot: 'bunda', name: 'Rifľová bunda', art: 'x_denim_jacket', stats: { armor: 3 }, rarity: 'bezny', desc: 'Vyblednutá od slnka aj od policajných svetiel. Klasika, ktorá nikdy nepýta otázky.' },
  coat_camel: { slot: 'bunda', name: 'Kabát z ťavej vlny', art: 'x_coat_camel', stats: { armor: 3 }, rarity: 'legendarny', desc: 'Dvojradový kabát, aký nosia muži, ktorí sa nikomu nemusia predstavovať. Vypadne len z bossa.' },
  sneaker_black: { slot: 'topanky', name: 'Čierne tenisky', art: 'x_sneaker_black', stats: { obratnost: 0.6 }, rarity: 'bezny' },
  // shoes: blue = common (Oblečenie), pink = epic (Black Market), gold = legendary (bosses)
  shoe_derby: { slot: 'topanky', name: 'Čierne poltopánky', art: 'x_shoe_derby', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Na pohreb, na súd aj na stretnutie s Donom. Do troch týždňov stihneš všetky tri.' },
  shoe_white_low: { slot: 'topanky', name: 'Biele tenisky', art: 'x_shoe_white_low', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Biele ako nevinnosť. Vydržia presne do prvej mláky pri večierke.' },
  shoe_air: { slot: 'topanky', name: 'Vzduchové tenisky', art: 'x_shoe_air', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Vzduchové bubliny v podrážke. Utekáš v nich, ako keby ťa niekto niesol.' },
  shoe_skate: { slot: 'topanky', name: 'Čierne skejtky', art: 'x_shoe_skate', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Hrubé šnúrky, plochá podrážka. Na skejt nevkročili, na plot pri parku každý deň.' },
  shoe_combat: { slot: 'topanky', name: 'Bojové čižmy', art: 'x_shoe_combat', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Osem dierok na šnúrky a oceľová špička. Dvere sa nimi otvárajú aj bez kľúča.' },
  shoe_canvas_high: { slot: 'topanky', name: 'Plátenné vysoké tenisky', art: 'x_shoe_canvas_high', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Klasika z každého koncertu a každej bitky po ňom.' },
  shoe_slides: { slot: 'topanky', name: 'Šľapky s pásikmi', art: 'x_shoe_slides', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'S ponožkami, samozrejme. Ak musíš utekať, máš problém.' },
  shoe_grey_runner: { slot: 'topanky', name: 'Sivé bežecké tenisky', art: 'x_shoe_grey_runner', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Nosia ich otcovia aj díleri. Polícia ich preto nevie od seba rozoznať.' },
  shoe_work_boot: { slot: 'topanky', name: 'Pracovné čižmy', art: 'x_shoe_work_boot', stats: { obratnost: 0.6 }, rarity: 'bezny', desc: 'Žlté čižmy zo stavby. Na stavbe si nikdy nebol, ale všetci si to myslia.' },
  shoe_hightop_red: { slot: 'topanky', name: 'Červeno-biele kotníkové tenisky', art: 'x_shoe_hightop_red', stats: { obratnost: 0.6 }, rarity: 'epicky', desc: 'Pár, za ktorý ľudia stoja v rade pred obchodom celú noc. Ty si v rade nestál.' },
  shoe_chunky: { slot: 'topanky', name: 'Masívne módne tenisky', art: 'x_shoe_chunky', stats: { obratnost: 0.6 }, rarity: 'epicky', desc: 'Podrážka hrubá ako tehla. Vyzerajú ťažko, ale nakopnú lepšie ako čižmy.' },
  shoe_loafer: { slot: 'topanky', name: 'Lakované mokasíny so zlatou prackou', art: 'x_shoe_loafer', stats: { obratnost: 0.6 }, rarity: 'epicky', desc: 'Zlatá pracka a lesk ako zrkadlo. V takých sa chodí len po kobercoch a po cudzích peniazoch.' },
  shoe_gold: { slot: 'topanky', name: 'Zlaté tenisky s diamantmi', art: 'x_shoe_gold', stats: { obratnost: 0.6 }, rarity: 'legendarny', desc: 'Zlato po členky a diamanty v šnúrkach. Nikto nevie, kto ich vyrobil. Vypadnú len z bossa.' },
  ring_ruby: { slot: 'prsten', name: 'Rubínový prsteň', art: 'x_ring_ruby', stats: { stastie: 0.6 }, rarity: 'epicky' },
  // rings from the 3×3 sheet: all blue = common (Šperky)
  ring_silver: { slot: 'prsten', name: 'Strieborná obrúčka', art: 'x_ring_silver', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Hladká a obyčajná. Nosí ju každý, kto chce vyzerať ženatý pred políciou.' },
  ring_black: { slot: 'prsten', name: 'Čierny oceľový prsteň', art: 'x_ring_black', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Matná čierna oceľ. Na päsť sedí lepšie ako boxer.' },
  ring_signet: { slot: 'prsten', name: 'Pečatný prsteň s erbom', art: 'x_ring_signet', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Kľúče a erb rodu, ktorý nikdy neexistoval. Pečatí sa ním každá dohoda.' },
  ring_skull: { slot: 'prsten', name: 'Prsteň s lebkou', art: 'x_ring_skull', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Lebka z čiernej ocele. Odtlačok na tvári dlžníka vydrží týždeň.' },
  ring_ruby_old: { slot: 'prsten', name: 'Starý zlatý prsteň s rubínom', art: 'x_ring_ruby_old', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Zlato je ošúchané, kameň je sklo. Vyzerá však presne ako ten pravý.' },
  ring_chain: { slot: 'prsten', name: 'Prsteň z reťaze', art: 'x_ring_chain', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Kubánske ohnivká stočené do kruhu. Reťaz na krk si dovolíš až budúci mesiac.' },
  ring_opal: { slot: 'prsten', name: 'Prsteň s opálom', art: 'x_ring_opal', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Kameň mení farbu podľa nálady. Tvoja je väčšinou zlá.' },
  ring_college: { slot: 'prsten', name: 'Absolventský prsteň', art: 'x_ring_college', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Modrý kameň a orol. Na vysokej si nebol, ale prsteň máš z obchodu so zálohou.' },
  ring_dollar: { slot: 'prsten', name: 'Prsteň so znakom dolára', art: 'x_ring_dollar', stats: { stastie: 0.6 }, rarity: 'bezny', desc: 'Zlatý dolár vysypaný kamienkami. Nenápadnosť nie je tvoja silná stránka.' },
  ring_nail: { slot: 'prsten', name: 'Zlatý prsteň v tvare klinca', art: 'x_ring_nail', stats: { stastie: 0.6 }, rarity: 'epicky', desc: 'Zlatý klinec omotaný okolo prsta, s radom diamantov na hlavičke. Pripomienka, že každý raz príde na rad.' },
  ring_nugget: { slot: 'prsten', name: 'Prsteň zo zlatého nugetu', art: 'x_ring_nugget', stats: { stastie: 0.6 }, rarity: 'epicky', desc: 'Kus surového zlata, ako ho vytiahli zo zeme. Pri podaní ruky to každý pocíti.' },
  ring_champion: { slot: 'prsten', name: 'Šampiónsky prsteň', art: 'x_ring_champion', stats: { stastie: 0.6 }, rarity: 'epicky', desc: 'Diamanty v kruhoch, erb a pohár na boku. Vyhral si ho v lige, o ktorej nikto nesmie vedieť.' },
  ring_emerald_cut: { slot: 'prsten', name: 'Platinový prsteň s obrovským diamantom', art: 'x_ring_emerald_cut', stats: { stastie: 0.6 }, rarity: 'legendarny', desc: 'Diamant veľký ako kocka cukru a okolo neho ďalšie desiatky. Svieti aj v tme. Vypadne len z bossa.' },
  // necklaces: blue = common (Šperky), pink = epic (Black Market), gold = legendary (bosses)
  neck_silver: { slot: 'retiazka', name: 'Strieborná retiazka', art: 'x_neck_silver', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Polovica hladká, polovica ohnivká. Ako ty: napoly slušný chlapec.' },
  neck_cross: { slot: 'retiazka', name: 'Tenká retiazka s krížikom', art: 'x_neck_cross', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Od babky na birmovku. Odvtedy videla veci, za ktoré by sa babka modlila.' },
  neck_cuban: { slot: 'retiazka', name: 'Zlatá kubánska retiazka', art: 'x_neck_cuban', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Hrubé ohnivká, tenké pozlátenie. Zatiaľ to nikto nezistil.' },
  neck_tags: { slot: 'retiazka', name: 'Vojenské známky', art: 'x_neck_tags', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Dve plieškové známky bez mena. Keby sa niečo stalo, nikto nebude vedieť, kto si bol.' },
  neck_tarnished: { slot: 'retiazka', name: 'Zelenajúca zlatá retiazka', art: 'x_neck_tarnished', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Kúpená ako zlato na trhovisku. Krk ti už zozelenel, retiazka sa ešte drží.' },
  neck_rosary: { slot: 'retiazka', name: 'Čierny ruženec', art: 'x_neck_rosary', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Čierne korálky a strieborný kríž. Modlíš sa len pred súdom.' },
  neck_rope: { slot: 'retiazka', name: 'Zlatá točená retiazka', art: 'x_neck_rope', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Točená ako lano, starý štýl z deväťdesiatok. Stále funguje.' },
  neck_padlock: { slot: 'retiazka', name: 'Retiaz s visacím zámkom', art: 'x_neck_padlock', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Kľúč zahodil do rieky. Kto ho chce dať dole, musí si priniesť flexu.' },
  neck_pawn: { slot: 'retiazka', name: 'Retiazka s pešiakom', art: 'x_neck_pawn', stats: { charizma: 0.6 }, rarity: 'bezny', desc: 'Zlatý pešiak na krku. Každý začína ako pešiak, len niektorí to dotiahnu ďalej.' },
  neck_jesus: { slot: 'retiazka', name: 'Ľadový prívesok s tvárou Krista', art: 'x_neck_jesus', stats: { charizma: 0.6 }, rarity: 'epicky', desc: 'Diamanty od tŕňovej koruny po bradu. Požehnanie, ktoré sa dá kúpiť.' },
  neck_tennis: { slot: 'retiazka', name: 'Diamantová tenisová retiazka', art: 'x_neck_tennis', stats: { charizma: 0.6 }, rarity: 'epicky', desc: 'Rad diamantov bez konca. Na tenis si ju nikto nikdy neobliekol.' },
  neck_clover: { slot: 'retiazka', name: 'Retiazka s čiernymi štvorlístkami', art: 'x_neck_clover', stats: { charizma: 0.6 }, rarity: 'epicky', desc: 'Päť čiernych štvorlístkov na zlatej retiazke. Šťastie, ktoré si niekto zaplatil vopred.' },
  neck_king: { slot: 'retiazka', name: 'Ľadová retiaz s kráľom', art: 'x_neck_king', stats: { charizma: 0.6 }, rarity: 'legendarny', desc: 'Šachový kráľ z diamantov s rubínom na hrudi. Pešiak sa stal kráľom. Vypadne len z bossa.' },
  watch_rose: { slot: 'hodinky', name: 'Hodinky z ružového zlata', art: 'x_watch_rose', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'legendarny' },
  watch_green: { slot: 'hodinky', name: 'Zelený ciferník', art: 'x_watch_green', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'legendarny' },
  // watches: blue = common (Šperky), pink = epic (Black Market), gold = legendary (bosses)
  watch_smart: { slot: 'hodinky', name: 'Chytré hodinky', art: 'x_watch_smart', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Rátajú kroky, tep aj kalórie. Polícia by rada vedela, kde všade si dnes bol.' },
  watch_gold_chrono: { slot: 'hodinky', name: 'Pozlátený chronograf', art: 'x_watch_gold_chrono', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Tri malé ciferníky a ani jeden neukazuje správny čas. Zlato sa zotrie do leta.' },
  watch_calc: { slot: 'hodinky', name: 'Hodinky s kalkulačkou', art: 'x_watch_calc', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Účtovník gangu na zápästí. Podiel z lupu si vyrátaš skôr, ako sa ostatní spýtajú.' },
  watch_field: { slot: 'hodinky', name: 'Vojenské hodinky', art: 'x_watch_field', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Látkový remienok, čísla čitateľné aj v tme pod mostom. Po starom otcovi, vraj.' },
  watch_diver: { slot: 'hodinky', name: 'Potápačské hodinky', art: 'x_watch_diver', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Vydržia dvesto metrov pod vodou. Testoval ich jeden dlžník v prístave.' },
  watch_gold_old: { slot: 'hodinky', name: 'Ošúchané zlaté hodinky', art: 'x_watch_gold_old', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Poškriabané sklo, rímske čísla. Zo záložne, a záložňa ich mala od niekoho, kto už nič nepotrebuje.' },
  watch_plastic: { slot: 'hodinky', name: 'Plastové hodinky s hviezdičkami', art: 'x_watch_plastic', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Žiarivo žltý remienok a hviezdičky. Nikto ťa nebude brať vážne, a presne o to ide.' },
  watch_rugged: { slot: 'hodinky', name: 'Odolné digitálky', art: 'x_watch_rugged', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Prežijú pád zo štvrtého poschodia. Ty asi nie.' },
  watch_digital: { slot: 'hodinky', name: 'Čierne digitálky', art: 'x_watch_digital', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'bezny', desc: 'Lacné, presné, nezničiteľné. Majú ich všetci, takže svedkovia si ich nezapamätajú.' },
  watch_daydate: { slot: 'hodinky', name: 'Zlaté hodinky s dňom a dátumom', art: 'x_watch_daydate', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'epicky', desc: 'Ukazujú aj deň v týždni, aby si vedel, kedy je splatný dlh. Celé zo zlata, aj náramok.' },
  watch_sub_green: { slot: 'hodinky', name: 'Oceľový potápač so zeleným lunetom', art: 'x_watch_sub_green', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'epicky', desc: 'Zelený ako peniaze, ktoré stáli. Na prvé stretnutie s Donom sa nosia práve tieto.' },
  watch_diamond: { slot: 'hodinky', name: 'Diamantové hodinky s odkrytým strojčekom', art: 'x_watch_diamond', stats: { charizma: 0.3, stastie: 0.3 }, rarity: 'legendarny', desc: 'Stovky diamantov a ozubené kolieska na očiach. Cena by kúpila celú ulicu. Vypadnú len z bossa.' },
};

export const SHOPS = {
  zbrane: { name: 'Zbrane', bases: ['bat', 'knuckles', 'knife', 'machete', 'glock', 'kalach', 'katana'], blurb: 'Nič nevidíš, nič nekupuješ.' },
  oblecenie: { name: 'Oblečenie', bases: ['jacket', 'pants', 'sneaker', 'sneaker_black', 'shoe_derby', 'shoe_white_low', 'shoe_air', 'shoe_skate', 'shoe_combat', 'shoe_canvas_high', 'shoe_slides', 'shoe_grey_runner', 'shoe_work_boot', 'shoe_hightop_red', 'shoe_chunky', 'shoe_loafer', 'jacket_puffer', 'puffer_red', 'varsity_gold', 'field_jacket', 'varsity_red', 'work_jacket', 'bomber_olive', 'track_navy', 'biker_jacket', 'denim_jacket', 'jeans_blue', 'track_pants', 'cargo_olive', 'carpenter_pants', 'cargo_camo', 'sweatpants', 'jeans_ripped', 'shorts_ball', 'cargo_compass', 'track_monogram', 'jeans_biker', 'jacket_compass', 'parka_fur', 'puffer_hood'], blurb: 'Čierna nikdy nevyjde z módy.' },
  sperky: { name: 'Šperky', bases: ['chain', 'neck_silver', 'neck_cross', 'neck_cuban', 'neck_tags', 'neck_tarnished', 'neck_rosary', 'neck_rope', 'neck_padlock', 'neck_pawn', 'neck_jesus', 'neck_tennis', 'neck_clover', 'ring', 'watch', 'ring_ruby', 'ring_silver', 'ring_black', 'ring_signet', 'ring_skull', 'ring_ruby_old', 'ring_chain', 'ring_opal', 'ring_college', 'ring_dollar', 'ring_nail', 'ring_nugget', 'ring_champion', 'watch_smart', 'watch_gold_chrono', 'watch_calc', 'watch_field', 'watch_diver', 'watch_gold_old', 'watch_plastic', 'watch_rugged', 'watch_digital', 'watch_daydate', 'watch_sub_green'], blurb: 'Zlato hovorí za teba.' },
};

// Every mission is a short story that ends with a fight against a weak NPC (see CONFIG.foe*).
// minutes = nominal length; below level CONFIG.fastUntil missions run much shorter (see F.durationFactor).
// story.foe.art: portrait shown in the fight; story.hit: the line that opens the fight.
export const MISSIONS = {
  sledovanie: { name: 'Sledovanie', minutes: 2, minLevel: 1, heat: 3, art: 'it_watch', stories: [
    { text: 'Don chce vedieť, s kým sa stretáva majiteľ práčovne. Sadni si na lavičku, tvár sa, že čítaš noviny, a pozeraj. Len si daj pozor, aby niekto nesledoval teba.',
      hit: 'Zvedavec z ulice si ťa všimol a nepáči sa mu, čo robíš.', foe: { name: 'Zvedavec', title: 'Pouličník', art: 'diler' } },
    { text: 'Nový chlapík na corneri chodí každý večer tou istou cestou. Zisti kam. Tieň za tebou ale nemusí byť len tvoj.',
      hit: 'Za rohom stojí rivalský pozorovateľ. Videl ťa skôr ako ty jeho.', foe: { name: 'Pozorovateľ', title: 'Rival z cornera', art: 'photo_rival' } },
  ] },
  dorucenie: { name: 'Doručenie zásielky', minutes: 4, minLevel: 1, heat: 5, art: 'it_package', stories: [
    { text: 'Balík, adresa, žiadne otázky. Čo je vnútri, ťa nezaujíma. Na druhej strane štvrte ťa už ale niekto čaká a nie je to adresát.',
      hit: 'Pouličný zlodejíček chce tvoj balík. Nedostane ho.', foe: { name: 'Zlodejíček', title: 'Pouličná zberba', art: 'diler' } },
    { text: 'Zásielka pre kamaráta z garáže. Cesta vedie cez park, kde sa večer motajú tí, čo nemajú čo stratiť.',
      hit: 'Opitý chuligán sa rozhodol, že dnes stratíš ty.', foe: { name: 'Chuligán', title: 'Opitý a nahnevaný', art: 'diler' } },
  ] },
  predaj: { name: 'Predaj tovaru', minutes: 6, minLevel: 1, heat: 6, art: 'it_duffel', stories: [
    { text: 'Dostal si tašku. Do večera musí zmiznúť. Kto vie, čo v nej je. Pozor, za rohom môžu číhať mačky. A mačky majú rady plné tašky.',
      hit: 'Mačka v civile. Odznak ukázal až po prvej rane.', foe: { name: 'Mačka', title: 'Policajt v civile', art: 'don' } },
    { text: 'Kupec chce tovar hneď a za hotové. Lenže kupci, ktorí platia hneď, zvyknú mať v rukáve aj niečo iné.',
      hit: 'Kupec nemá peniaze. Má len päste.', foe: { name: 'Kupec', title: 'Podozrivý zákazník', art: 'don' } },
  ] },
  vymahanie: { name: 'Vymáhanie dlhu', minutes: 9, minLevel: 3, heat: 10, art: 'it_bat', stories: [
    { text: 'Jeden chlapík nám dlhuje. Sedí doma a počíta peniaze, ktoré nie sú jeho. Pripomeň mu, komu patria.',
      hit: 'Dlžník sa rozhodol, že platiť nebude. Aspoň nie dobrovoľne.', foe: { name: 'Dlžník', title: 'Počíta cudzie peniaze', art: 'photo_dlznik' } },
    { text: 'Majiteľ večierky zabudol na mesačnú platbu. Pripomenutie musí byť zdvorilé. Prvýkrát.',
      hit: 'Synovec majiteľa si myslí, že zdvorilosť je slabosť.', foe: { name: 'Synovec', title: 'Z večierky', art: 'diler' } },
  ] },
  kradez_auta: { name: 'Krádež auta', minutes: 8, minLevel: 4, heat: 10, art: 'it_keys', stories: [
    { text: 'Pred klubom stojí čierne auto, ktoré už nepatrí svojmu majiteľovi. Kľúče máš, stačí ho odviezť do garáže. Šofér však nespí.',
      hit: 'Šofér vystúpil z auta a nevyzerá, že by sa chcel rozlúčiť.', foe: { name: 'Šofér', title: 'Verný svojmu šéfovi', art: 'don' } },
    { text: 'Autobazár dostal nový kúsok. Don ho chce skôr, než ho niekto kúpi. Nočná zmena by mala spať.',
      hit: 'Nočný strážnik nespí. A má baterku aj obušok.', foe: { name: 'Strážnik', title: 'Nočná zmena', art: 'diler' } },
  ] },
  prepadnutie: { name: 'Prepadnutie rivala', minutes: 10, minLevel: 6, heat: 12, art: 'it_bat', stories: [
    { text: 'Červení si myslia, že im patrí corner. Prejdi okolo a ukáž im, že sa mýlia.',
      hit: 'Rivalský pešiak vytiahol zbraň skôr, než si stihol pozdraviť.', foe: { name: 'Pešiak', title: 'Červený gang', art: 'photo_rival' } },
    { text: 'Kuriér rivalov nosí každý piatok obálku. Dnes ju donesie nám.',
      hit: 'Kuriér obálku len tak nepustí.', foe: { name: 'Kuriér', title: 'Červený gang', art: 'photo_rival' } },
  ] },
  ochrana: { name: 'Ochrana podniku', minutes: 12, minLevel: 8, heat: 6, art: 'it_pistol', stories: [
    { text: 'Postráž bar, kým sa nezotmie. Nikto nesmie robiť problémy. Jeden to aj tak skúsi.',
      hit: 'Výtržník rozbil pohár a pozerá rovno na teba.', foe: { name: 'Výtržník', title: 'Hosť bez pozvania', art: 'diler' } },
    { text: 'Majiteľ klubu platí za pokoj. Dnes večer príde niekto, kto pokoj nemá rád.',
      hit: 'Vyhadzovač konkurencie prišiel robiť poriadok po svojom.', foe: { name: 'Vyhadzovač', title: 'Od konkurencie', art: 'photo_rival' } },
  ] },
  kradez_sklad: { name: 'Krádež zo skladu', minutes: 15, minLevel: 10, heat: 12, art: 'it_duffel', stories: [
    { text: 'Sklad pri klube je dnes v noci prázdny. Skoro. Jeden strážnik zostal a nemá dobrú náladu.',
      hit: 'Strážnik skladu zhasol baterku a vyšiel z tmy.', foe: { name: 'Strážnik', title: 'Sklad rivalov', art: 'diler' } },
    { text: 'V sklade rivalov leží hotovosť za tisíce. Dvere sú otvorené, pes nie je. Zato je tam niekto horší.',
      hit: 'Pokladník rivalov práve počíta. A nerád sa necháva rušiť.', foe: { name: 'Pokladník', title: 'Červený gang', art: 'photo_dlznik' } },
  ] },
};

// photo: wide header image + focus (CSS object-position)
export const GIVERS = {
  don: { name: 'Don', title: 'Zadávateľ misií', portrait: 'photo_don', photo: 'photo_don_wide', focus: '78% 30%', quote: 'Mám pre teba robotu. Rýchlu, čistú a dobre zaplatenú.', pool: ['sledovanie', 'dorucenie', 'predaj', 'vymahanie', 'ochrana', 'prepadnutie', 'kradez_sklad'] },
  diler: { name: 'Díler', title: 'Pouličný obchod', portrait: 'photo_diler', photo: 'photo_diler_wide', focus: '40% 20%', quote: 'Tovar je, ľudia sú. Chýbaš mi len ty.', pool: ['sledovanie', 'dorucenie', 'predaj', 'kradez_auta'] },
};

// art: portrait in fights (transparent bust or photo_*); wide: big illustration for the boss screen;
// focus: CSS object-position of the wide image
export const BOSSES = [
  { name: 'Kladivo', title: 'Miestny vymáhač', art: 'kladivo', profile: { sila: 1.3, odolnost: 1.2, obratnost: 0.7, charizma: 0.6, stastie: 1.2 } },
  { name: 'Kazateľ', title: 'Káže, kým ostatní platia', art: 'photo_kazatel', wide: 'photo_kazatel_wide', focus: '55% 20%', profile: { sila: 0.9, odolnost: 1.0, obratnost: 1.0, charizma: 1.3, stastie: 0.8 } },
  { name: 'Kožuch', title: 'Úžerník z penthousu', art: 'photo_kozuch', wide: 'photo_kozuch_wide', focus: '40% 22%', profile: { sila: 1.3, odolnost: 1.4, obratnost: 0.6, charizma: 1.0, stastie: 0.7 } },
  { name: 'Žiletka', title: 'Rezák z cornera', art: 'photo_ziletka', wide: 'photo_ziletka', focus: '50% 38%', profile: { sila: 1.0, odolnost: 0.8, obratnost: 1.4, charizma: 0.6, stastie: 1.2 } },
  { name: 'Šťastný Charlie', title: 'Kartár v župane', art: 'photo_charlie', wide: 'photo_charlie_wide', focus: '58% 0%', titleLow: true, profile: { sila: 0.7, odolnost: 1.0, obratnost: 0.9, charizma: 1.3, stastie: 1.6 } },
  { name: 'Lasica', title: 'Zlodej áut', profile: { sila: 0.8, odolnost: 0.9, obratnost: 1.5, charizma: 0.8, stastie: 1.0 } },
  { name: 'Doktor', title: 'Pašerák', profile: { sila: 0.9, odolnost: 1.0, obratnost: 1.0, charizma: 1.3, stastie: 0.8 } },
  { name: 'Bager', title: 'Kápo stavbárov', profile: { sila: 1.5, odolnost: 1.3, obratnost: 0.5, charizma: 0.7, stastie: 1.0 } },
  { name: 'Šakal', title: 'Nájomný vrah', profile: { sila: 1.2, odolnost: 0.8, obratnost: 1.3, charizma: 0.5, stastie: 1.2 } },
  { name: 'Vdova', title: 'Majiteľka klubu', profile: { sila: 0.8, odolnost: 1.1, obratnost: 1.1, charizma: 1.4, stastie: 0.6 } },
  { name: 'Starý Vincent', title: 'Šéf mesta', profile: { sila: 1.2, odolnost: 1.2, obratnost: 1.0, charizma: 1.0, stastie: 1.0 } },
];

export const BOT_NAMES = ['Šakal', 'Vrana', 'Malý Jano', 'Zub', 'Betónko', 'Sivý', 'Fero Nôž', 'Lord', 'Duch', 'Roxor', 'Kobra', 'Miro Klinec', 'Tichý', 'Bárny', 'Zlatko', 'Krtko', 'Doga', 'Rambo z Petržalky'];

// ---------------------------------------------------------------- the map: Mesto 1 (levels 1–49), after a slice of Düsseldorf
// The city is generated by tools/art/City.cs into assets/world/map_base.png + city.json. Buildings there have ids
// (city.json "marks"); `at: id` puts a thing at that building's door, `roof: id` on its roof.
export const SPAWN = { x: 705, y: 782 };

// Static NPCs. angle: 0 = facing down, 180 = up, -90 = right, 90 = left
export const NPCS = [
  { id: 'don', sprite: 'p_zadavatel', x: 664, y: 764, angle: -90, bubble: 'bubble' },
  { id: 'diler', sprite: 'p_diler', at: 'diler', angle: -90, bubble: 'bubble' },
  { id: 'kladivo', sprite: 'p_boss', at: 'kladivo', angle: -90, bubble: 'bubble_gold' },
  { id: 'mechanik', sprite: 'p_mechanik', at: 'mechanik', angle: -90 },
  { id: 'pravnicka', sprite: 'p_pravnicka', at: 'pravnicka', angle: 90 },
  { id: 'lekarka', sprite: 'p_lekarka', at: 'lekarka', angle: 0 },
  { id: 'wexler', sprite: 'p_dealer', x: 746, y: 764, angle: 90, bubble: 'bubble_gold' },
];

// Points the player can interact with (radius in map px)
export const POIS = [
  { id: 'don', name: 'Don', verb: 'Hovoriť', action: 'missions', arg: 'don', x: 664, y: 764, r: 22 },
  { id: 'diler', name: 'Díler', verb: 'Hovoriť', action: 'missions', arg: 'diler', at: 'diler', r: 22 },
  { id: 'kladivo', name: 'Boss', verb: 'Bojovať', action: 'boss', at: 'kladivo', r: 22 },
  { id: 'wexler', name: 'Wexler · zlaté tehličky', verb: 'Hovoriť', action: 'wexler', x: 746, y: 764, r: 22 },
  { id: 'zbrane', name: 'Zbrane', verb: 'Vstúpiť', action: 'shop', arg: 'zbrane', at: 'zbrane', r: 16 },
  { id: 'oblecenie', name: 'Oblečenie', verb: 'Vstúpiť', action: 'shop', arg: 'oblecenie', at: 'oblecenie', r: 16 },
  { id: 'sperky', name: 'Šperky', verb: 'Vstúpiť', action: 'shop', arg: 'sperky', at: 'sperky', r: 16 },
  { id: 'tetovanie', name: 'Tetovanie', verb: 'Vstúpiť', action: 'soon', arg: 'Tetovací salón (kozmetika) príde neskôr.', at: 'tetovanie', r: 16 },
  { id: 'posilnovna', name: 'Posilňovňa', verb: 'Trénovať', action: 'character', at: 'posilnovna', r: 20 },
  { id: 'arena', name: 'Aréna', verb: 'Vstúpiť', action: 'arena', at: 'arena', r: 20 },
  { id: 'mechanik', name: 'Garáž · mechanik', verb: 'Vylepšiť', action: 'upgrade', at: 'mechanik', r: 22 },
  { id: 'pravnicka', name: 'Právnička', verb: 'Hovoriť', action: 'lawyer', at: 'pravnicka', r: 22 },
  { id: 'lekarka', name: 'Lekárka', verb: 'Hovoriť', action: 'soon', arg: 'Liečenie po súbojoch príde spolu s gangmi.', at: 'lekarka', r: 22 },
];

// ---------------------------------------------------------------- Gang Wars
// Kinds of turf objects: defenders = how many guard it, lvl = their level offset from the player,
// slots = how many of your members can defend it, bonus = what the whole gang gets while holding it.
export const TURF_KINDS = {
  corner: { name: 'Corner', defenders: 2, lvl: [-2, 0], slots: 2, bonus: { cash: 0.02 }, text: '+2 % peňazí z misií' },
  garaz: { name: 'Garáž', defenders: 3, lvl: [0, 1], slots: 3, bonus: { time: 0.05 }, text: '−5 % čas misií' },
  sklad: { name: 'Sklad', defenders: 3, lvl: [1, 2], slots: 3, bonus: { epic: 0.03 }, text: '+3 % šanca na drop epického predmetu z misie' },
  klub: { name: 'Klub', defenders: 4, lvl: [0, 2], slots: 4, bonus: { cash: 0.05, xp: 0.03 }, text: '+5 % peňazí a +3 % XP z misií' },
};

// 12 objects of Mesto 1 (the building with the same id in city.json); start: who holds it in a new game
export const TURF = [
  { id: 'corner1', kind: 'corner', name: 'Corner na Grabenskej', start: null },
  { id: 'corner2', kind: 'corner', name: 'Corner na Ladskej', start: 'cerveni' },
  { id: 'corner3', kind: 'corner', name: 'Corner pri Kronprinzovej', start: 'hadi' },
  { id: 'corner4', kind: 'corner', name: 'Corner na Kostolnej', start: 'kostlivci' },
  { id: 'corner5', kind: 'corner', name: 'Corner na Východnej', start: null },
  { id: 'garaz1', kind: 'garaz', name: 'Garáž na bulvári', start: 'hadi' },
  { id: 'garaz2', kind: 'garaz', name: 'Garáž na Západnej', start: null },
  { id: 'garaz3', kind: 'garaz', name: 'Garáž na juhu', start: 'kostlivci' },
  { id: 'sklad1', kind: 'sklad', name: 'Sklad na Východnej', start: 'cerveni' },
  { id: 'sklad2', kind: 'sklad', name: 'Severný sklad', start: 'hadi' },
  { id: 'klub1', kind: 'klub', name: 'Klub na Bilkerskej', start: 'cerveni' },
  { id: 'klub2', kind: 'klub', name: 'Klub na Alžbetinej', start: 'kostlivci' },
];

POIS.push(...TURF.map((t) => ({ id: t.id, name: t.name, verb: 'Pozrieť', action: 'turf', arg: t.id, at: t.id, r: 18 })));

// computer-run rival gangs of Mesto 1 (never purple)
export const RIVAL_GANGS = {
  cerveni: { name: 'Červení', tag: 'CRV', color: '#c8342a' },
  kostlivci: { name: 'Kostlivci', tag: 'KST', color: '#e9e4d8' },
  hadi: { name: 'Modrí hadi', tag: 'HAD', color: '#2f74c0' },
};

export const GANG_COLORS = [
  { id: 'gold', name: 'zlatá', color: '#e0b444' },
  { id: 'green', name: 'zelená', color: '#4f9a45' },
  { id: 'orange', name: 'oranžová', color: '#e07a2a' },
  { id: 'teal', name: 'tyrkysová', color: '#2fa8a0' },
];

export const GANG_RANKS = { boss: 'Boss', ruka: 'Pravá ruka', vojak: 'Vojak', novacik: 'Nováčik' };

// bought from the gang treasury; per level
export const GANG_UPGRADES = {
  vycvik: { name: 'Výcvik', per: 0.02, text: (n) => '+' + n * 2 + ' % XP z misií' },
  vypalne: { name: 'Výpalné', per: 0.02, text: (n) => '+' + n * 2 + ' % peňazí z misií' },
  opevnenie: { name: 'Opevnenie', per: 0.1, text: (n) => '+' + n * 10 + ' % sily obrany objektov' },
};

// Map labels. kind drives the colour; minZoom/maxZoom hide labels at some zoom levels; roof: id sits on that
// building; npc labels sit above the character (dy) and light up when that giver has a reward waiting.
export const LABELS = [
  // districts (seen when zoomed out)
  { text: 'Park pri jazierkach', x: 590, y: 240, kind: 'district', maxZoom: 1.6 },
  { text: 'Bulvár', x: 1000, y: 470, kind: 'district', maxZoom: 1.6 },
  { text: 'Námestie', x: 705, y: 715, kind: 'district', maxZoom: 1.6 },
  { text: 'Kancelárie', x: 960, y: 240, kind: 'district', maxZoom: 1.6 },
  { text: 'Staré domy', x: 190, y: 250, kind: 'district', maxZoom: 1.6 },
  { text: 'Západ', x: 190, y: 640, kind: 'district', maxZoom: 1.6 },
  { text: 'Juh', x: 600, y: 935, kind: 'district', maxZoom: 1.6 },
  { text: 'Východ', x: 1145, y: 640, kind: 'district', maxZoom: 1.6 },
  // places (seen up close)
  { text: 'Zbrane', roof: 'zbrane', dy: -34, kind: 'shop', minZoom: 1.6 },
  { text: 'Oblečenie', roof: 'oblecenie', dy: -34, kind: 'shop', minZoom: 1.6 },
  { text: 'Šperky', roof: 'sperky', dy: -34, kind: 'shop', minZoom: 1.6 },
  { text: 'Tetovanie', roof: 'tetovanie', dy: -34, kind: 'shop', minZoom: 1.6 },
  { text: 'Obchody', x: 720, y: 600, kind: 'shop', maxZoom: 1.6 },
  { text: 'Aréna', roof: 'arena', kind: 'arena' },
  { text: 'Posilňovňa', roof: 'posilnovna', dy: -36, kind: 'service' },
  { text: 'Lekárka', roof: 'lekarka', kind: 'service' },
  { text: 'Právnička', roof: 'pravnicka', dy: -36, kind: 'service' },
  { text: 'Don', npc: 'don', x: 664, y: 764, dy: -22, kind: 'npc' },
  { text: 'Díler', npc: 'diler', at: 'diler', dy: -22, kind: 'npc' },
  { text: 'Boss', at: 'kladivo', dy: -22, kind: 'boss' },
  { text: 'Wexler', x: 746, y: 764, dy: -22, kind: 'mine' },
  { text: 'Mechanik', at: 'mechanik', dy: -16, kind: 'dim', minZoom: 2 },
];
// street life (they move on the street graph from city.json)
export const TRAFFIC_CARS = ['car_sedan_blue', 'car_taxi', 'car_sedan_red', 'car_van', 'car_sedan_white', 'car_pickup', 'car_sedan_green', 'car_taxi', 'car_sedan_blue', 'car_van'];
export const POLICE_CARS = 2;
export const WALKER_SPRITES = ['p_chodkyna', 'p_chodec', 'p_chodec', 'p_chodkyna', 'p_svalovec', 'p_dealer', 'p_zlodej'];
export const WALKER_COUNT = 22;
