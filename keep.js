/* ============================================================
   KEEP.JS — "nosirt's keep" feature
   Load this AFTER core.js.
   Contains: the castle gate/password, and the library/reader —
   including the LIBRARY object where all book & chapter content
   lives. Add new stories by adding entries to LIBRARY below.
   ============================================================ */

// ═══ CASTLE ═══
function openCastle(){$('castle-door').classList.add('open');}
function closeCastle(){$('castle-door').classList.remove('open');$('castle-input').value='';$('castle-wrong').textContent='';}
function tryCastle(){
  if($('castle-input').value.trim().toLowerCase()===CASTLE_PW){
    $('castle-door').classList.remove('open');$('castle-input').value='';$('castle-wrong').textContent='';
    $('castle-interior').classList.add('open');
    setTimeout(renderBookList,50);
  }else{
    $('castle-input').classList.add('wrong');$('castle-wrong').textContent='the gate remains sealed.';
    setTimeout(()=>$('castle-input').classList.remove('wrong'),420);$('castle-input').value='';
  }
}
function closeInterior(){
  $('castle-interior').classList.remove('open');
  // Reset to library view when closing
  setTimeout(()=>{
    $('reader-view').style.display='none';
    $('library-view').style.display='flex';
  },300);
}

// ═══════════════════════════════════════
// CASTLE LIBRARY
// ═══════════════════════════════════════

const LIBRARY = {
  novels: [
    {
      id: 'forsaken-bride',
      title: 'The Forsaken Bride of the North',
      author: 'Prequal',
      desc: 'A young girl betrothed at twelve to a lord she barely knows. A husband claimed by war. A woman forged by everything that followed.',
      genre: 'Historical Fiction',
      chapters: [
        {
          title: 'Dedication',
          content: `To Elara, my steadfast beacon.

This story, woven from the threads of your extraordinary resilience, is a testament to a love that endures beyond absence, a spirit that blossoms in the harshest of soils. You are the whispered lullaby in the stormy night, the unwavering hand that guides through shadowed valleys.

Though the years may have etched their passage upon your brow, they have only deepened the luminescence of your inner fortitude. You, who bore the weight of a world's indifference with a grace that defied despair, who transformed the barren landscape of abandonment into a garden of quiet triumph.

You are the architect of dreams for those you cherished, the quiet warrior who fought every battle with a love so profound it became its own battlefield. This narrative, born of your strength, seeks to echo the silent songs of your courage, the unwavering devotion that illuminated the darkest of days.

You are the unsung heroine, the mother, the wife, the unwavering heart whose sacrifices paved the way for futures unimagined. Your story is not one of mere survival, but of a profound, enduring victory, a testament to the indomitable power of a mother's love.

May this tale, in its humble way, honor the immeasurable depths of your character, the quiet strength that carved pathways through hardship, and the enduring legacy of your remarkable spirit. You are the foundation upon which so much was built, the silent architect of happiness, and this is my tribute to the extraordinary woman who taught us all the true meaning of perseverance.`
        },
        {
          title: 'Chapter 1: The Gilded Cage',
          content: `The air crackled, not with the playful sparks of a summer storm, but with the ominous prelude to a tempest that mirrored the roiling chaos within Elara's young heart. Outside the towering stone walls of her ancestral home, the sky wept a furious deluge, each crack of thunder a violent punctuation to the pronouncements that had sealed her fate. At twelve years of age, a mere slip of a girl on the cusp of womanhood, she was no longer Elara, daughter of Lord Valerius. She was a commodity, a bargaining chip in the brutal, unending game of feudal politics. Her childhood, a tapestry of sun-drenched meadows and whispered bedtime stories, was being torn asunder, its vibrant threads replaced by the somber hues of obligation and sacrifice.

The grand hall, usually alive with the boisterous laughter of her brothers and the gentle strumming of the minstrel's lute, was now hushed, the silence more oppressive than any storm's fury. Torches cast dancing, distorted shadows that leered like specters, their flickering light glinting off the cold steel of the knights assembled, their stoic faces impassive witnesses to a transaction that held no warmth, only consequence. Her father, his face a mask of practiced composure that couldn't quite conceal the flicker of regret in his aged eyes, stood beside a man whose stern demeanor and bearing spoke of power, of armies, of a future far removed from Elara's innocent dreams. Lord Armand de Valois. The name was a foreign whisper on the wind, a stranger's decree.

The parchment lay between them, its elegant script a testament to the legal binding of two souls, or rather, of two bloodlines. Elara's gaze was drawn to the stark, official language, the cold pronouncements of her worth measured in dowry and strategic alliance. Her hand, small and trembling, was guided by her mother's trembling one to the quill, its dark ink an indelible stain upon her future. The pressure of the quill against the vellum was a physical manifestation of the weight pressing down on her chest, making each breath a shallow, stolen gasp. The scent of dried ink and beeswax mingled with the damp, earthy smell of the approaching storm, a potent, suffocating perfume of farewell.

"You are to be a bride, Elara," her mother's voice was a strained whisper, laced with a sorrow Elara was too young to fully comprehend, yet too keenly felt to ignore. "A Lady of Valois. It is an honor, child. A great honor."

Honor. The word felt like a shard of ice in her gut. Her younger brother, Finn, with his bright, mischievous eyes and a heart as open as the summer sky, had been playing with wooden soldiers by the hearth just moments before, his world untroubled by such weighty pronouncements. He would remain here, in the familiar embrace of their home, his laughter echoing through these halls. Elara, however, was to be transplanted, her roots wrenched from the soil she had always known, her young sapling existence destined to be grafted onto an alien vine.

The implications settled upon her like a shroud. Her lessons of needlepoint and Latin were to be replaced by the duties of a wife, a mistress of a household she had never seen, a companion to a man whose face was a blur of stern lines and unfamiliar authority. She had glimpsed Lord Armand before, a figure of imposing stature who spoke in clipped, authoritative tones, his gaze often sweeping over her as if assessing a well-bred mare. He was twice her father's age, a seasoned warrior whose name was spoken with a mixture of respect and trepidation throughout the kingdom.

The agreement was simple, brutally so. The union would forge a powerful alliance between her father's northern territories, rich in timber and furs, and Lord Armand's southern holdings, strategically vital for their control of trade routes. In exchange for Elara's hand, Lord Armand would lend his considerable military might to secure her father's borders against the encroaching threat from the Eastern Marches. It was a pragmatic arrangement, devoid of sentiment, where Elara's girlhood was merely the price of peace, the currency of power.

She remembered her mother's hushed conversations with her father in the dimly lit solar, the worried lines etched deeper into her brow with each passing week. She had overheard fragments – "risky venture," "desperate times," "no other suitor of his standing." The weight of these words had pressed down on her, a silent premonition of the impending change. Now, the premonition had solidified into a cold, hard reality.

The pronouncement of her departure was delivered with a finality that allowed for no appeal. Her small trunk, filled with a few carefully chosen gowns and her beloved collection of smooth, sea-worn pebbles, was packed by trembling maids. Her favorite tapestry, depicting a brave knight rescuing a maiden from a dragon, was carefully folded and placed at the very bottom, a poignant reminder of the fantasies she was being forced to abandon. Her room, once a sanctuary filled with the scent of dried lavender and the warmth of her own dreams, now felt like a cage, its familiar comforts already becoming the relics of a life that was rapidly receding.

The storm outside raged with an intensity that seemed to mock the forced composure within. Rain lashed against the leaded windows, distorting the familiar landscape into a watery, impressionistic blur. Each gust of wind that rattled the ancient timbers of the castle seemed to carry away a piece of Elara's innocence. She stood by the window, her small hands pressed against the cool glass, watching the familiar oak trees bend and sway, their sturdy trunks appearing fragile against the onslaught. She was like them, she thought, about to be tested by a force beyond her control, her own resilience as yet unknown.

Lord Armand's retinue was a stark contrast to the familiar faces of her father's household knights. Clad in dark, practical leather and mail, their demeanor was grim, their faces weathered and hardened by the harsh realities of a life spent on campaign. They were the wolf pack that would escort their new prize, their presence a constant reminder of the dangerous world that awaited her. Their leader, a gruff, scarred man named Borin, met her father's gaze with a curt nod, his eyes holding no warmth, only the blunt efficiency of a soldier fulfilling a duty.

The goodbyes were a blur of tearful embraces and choked reassurances. Her mother, her face pale and drawn, pressed a small, intricately carved locket into Elara's hand. "Guard this, my child," she whispered, her voice thick with unshed tears. "It holds a lock of your father's hair. And know this, always: you are loved, no matter where your path may lead." Elara clutched the cool metal, its familiar weight a small comfort against the gnawing emptiness that was beginning to bloom within her.

Her father, his hand resting heavily on her shoulder, offered a rare, strained smile. "Be strong, Elara. You are a Valerius. We do not break."

But Elara felt as if she were already splintering, her young spirit already cracked under the immense pressure of this sudden, irreversible transition. As she was led out to the waiting destrier, its imposing size and powerful build a stark contrast to the gentle ponies she was accustomed to, she cast one last, longing look back at the castle, its familiar silhouette fading into the driving rain. The drawbridge, a symbol of her departure, was raised behind her, a definitive, resounding thud that echoed the slamming of a door on her past.

The journey was a grueling ordeal. The storm, far from abating, intensified, transforming the already treacherous paths into muddy quagmires. Rain seeped through the thick wool of her traveling cloak, chilling her to the bone. The rhythmic thud of hooves on the sodden earth was a monotonous drumbeat, each beat marking the steady march away from everything she had ever known. The knights rode in a tight formation, their faces impassive, their silence a palpable presence that offered no comfort. Elara huddled within her cloak, her knees drawn to her chest, the locket a cold anchor against her skin.

She felt a profound sense of disorientation, as if she were adrift in a vast, indifferent sea. The wind howled like a mournful spirit, carrying with it the scent of pine and damp earth, a scent alien and foreboding. The trees, tall and menacing, seemed to lean in, their branches like skeletal fingers reaching out to grasp her. She caught glimpses of the world beyond the immediate press of riders – dark, brooding forests, windswept moors shrouded in mist, and the occasional, desolate-looking farmstead. It was a land that spoke of hardship, of struggle, of a wildness that was both captivating and terrifying.

Her mind, however, was a battlefield of conflicting emotions. Fear, raw and primal, warred with a nascent flicker of defiance. She was a pawn, yes, but a pawn with a mind that could observe, and a spirit that, though trembling, had not yet been entirely broken. She clung to the memory of her mother's words, the warmth of her embrace, the weight of the locket – small anchors in the churning sea of her despair.

As the days bled into one another, marked by the relentless march and the somber, silent meals taken under the watchful eyes of the knights, Elara began to withdraw into herself. The vibrant curiosity that had once defined her childhood was replaced by a quiet, observant stillness. She was being prepared, she realized, not for a life of gentle domesticity, but for one of resilience, of a strength she had not yet discovered within herself.

The gilded cage of her future was not one of comfort and luxury, but one of duty and danger, a cage forged from the iron of necessity and the cold steel of political expediency. Her childhood had been abruptly curtailed, its innocent dawn overshadowed by the looming twilight of an arranged betrothal. The storm outside mirrored the tempest within, a prelude to the tumultuous life that lay before her — a life she was utterly unprepared for, yet one from which there was no turning back.`
        },
        {
          title: 'Chapter 2: The War-Torn Heart',
          content: `The air within Blackwood Manor, usually thick with the scent of aged wood and the faintest hint of decaying grandeur, had taken on a new, metallic tang. It was the smell of blood, of fear, of a world beyond the manicured lawns and ancient stones that Elara had come to know. It had been weeks since the last whispered rumour of Kaelen's return, weeks of strained anticipation, of replaying her imagined triumphant reunions in the echoing silence. But the reality, when it finally strode through the heavy oak doors, was a brutal dissection of her dreams.

He was Kaelen, undeniably. The familiar set of his jaw, the breadth of his shoulders, the way his dark hair fell across his brow – all were present. Yet, they were overlaid with a grim unfamiliarity. The boy who had left, hesitant but earnest, was gone, replaced by a stranger cloaked in the grim mantle of war. His eyes, once alight with a youthful, if duty-bound, spark, were now pools of shadowed exhaustion. They held a disquieting stillness, a profound weariness that seemed to have leached the very colour from his youth.

Elara, positioned at the foot of the grand staircase, her heart a frantic bird trapped within her chest, felt the carefully constructed edifice of her hopes crumble. The heroic warrior she had conjured, bathed in the golden light of victory, was nowhere to be seen. Instead, a man emerged from the shadows, his armor scuffed and stained, not with the honourable marks of a hard-fought campaign, but with the grim patina of survival. He moved with a strange, almost mechanical grace, a precision born of ingrained reflexes rather than inner vitality.

He didn't stride. He simply walked, his heavy boots thudding a mournful rhythm on the polished flagstones. The triumphant cheers she had rehearsed died in her throat, replaced by a hollow echo. He carried no laurels, no trophies, only the silent burden of what he had endured. He was not a celebrated victor; he was a survivor, and the distinction was stark, brutal, and devastating.

As he drew closer, Elara noticed the tremors in his hands, subtle but undeniable. His face, once a canvas of youthful idealism, was now a landscape of grim determination, punctuated by a profound sadness that settled deep in his bones. It was the look of a man who had seen too much, felt too much, and carried the weight of it all in the slump of his shoulders, the guarded set of his jaw.

He offered no embrace, no whispered word of greeting, no acknowledgment of her presence beyond a fleeting, impersonal sweep of his gaze. He simply nodded, a curt, almost imperceptible movement, and turned to shed the external trappings of his journey.

Elara stood frozen, her breath catching in her throat, the vibrant tapestry of her dreams unraveling thread by thread. The envisioned warmth of his homecoming was now a bitter mockery. The air, once alive with her silent anticipation, now felt heavy, charged with an unspoken sorrow. His presence, so ardently desired, filled the vast hall with an unsettling tension, a palpable aura of suffering that created a chasm between them, wider and deeper than any physical distance. This was not the return of her hero; this was the arrival of a stranger.

Later, Elara tried to reconcile the man who had arrived with the man she had yearned for. She had dreamt of shared confidences, of evenings spent by the fire, recounting their separate experiences. But how could she share her anxieties about Blackwood Manor with a man who had faced death on the battlefield? The chasm between their experiences was not a matter of choice, but of survival.

One evening, driven by a desperate need to bridge the growing distance, she brought herself to his study. He was seated at his desk, a single candle casting long, dancing shadows across his face.

"Kaelen?" Her voice was a mere whisper.

He started, then slowly raised his head. His eyes met hers, and for a moment, she thought she saw a flicker of recognition, perhaps a deep, buried pain. But it was gone as quickly as it appeared.

"Elara," he replied, his voice a low rumble, devoid of inflection.

She held a small, intricately carved wooden bird, a token she had intended to give him upon his return. "I had this made for you," she began, her voice trembling. "While you were away."

He looked at the bird, his gaze lingering on it for a moment. "It is well-crafted," he said, his tone neutral, almost dismissive. He then turned back to his map.

The rejection, though subtle, was a physical blow. The hope that had sustained her through his absence shriveled and died within her. This was not the homecoming of a stranger; it was the arrival of a man lost to himself, a man who carried the war within him.

One afternoon, Elara found Kaelen standing in the grand hall, staring out of the tall, arched window. He stood utterly still, a statue carved from sorrow. After a long moment, he finally spoke, his voice flat, devoid of emotion.

"The trees… they whisper the names of the fallen. I hear them, Elara. Always."

Elara's breath hitched. It was the first time he had spoken so openly about the torment that plagued him. She stepped closer, placing a tentative hand on his arm.

"What do they say, Kaelen?" she asked softly.

He finally turned to her, his eyes the color of a stormy sea. "They accuse. They condemn. They ask why I live when they do not. They remind me of every life taken, every prayer left unanswered." He paused, a shudder running through him. "And sometimes… they call my name. As if they expect me to join them."

A tear traced a slow path down Elara's cheek. She took his hand, her touch gentle but firm. "You are not responsible for their deaths, Kaelen. You survived. That is your right. That is your burden to bear, but you do not bear it alone." She squeezed his hand. "I am here. We are here. You are home."

He looked at her, his gaze lingering, as if seeing her for the first time in a long while. A flicker of recognition seemed to surface in the depths of his stormy eyes. But it was fleeting, a brief candle flame in a vast darkness.

She was a wife who had married a warrior, only to find herself married to a ghost, forever caught in the echoes of a war that refused to end.`
        },
        {
          title: 'Chapter 3: The Unyielding Bloom',
          content: `The creak of the floorboards beneath Elara's bare feet was a familiar, mournful sound in the pre-dawn stillness. Blackwood Manor, a monument to a past prosperity, now seemed to sigh with the weight of its own decay. The hearth in the grand hall was cold, its ashes swept clean not for warmth, but to conserve what little fuel remained. Her children, blessedly lost in dreams, were unaware of the gnawing chill that seeped into the very bones of their home.

Elara's days had become a relentless cycle of hushed conversations, averted gazes from loyal staff who knew too much, and the constant, gnawing fear of insolvency. The ledgers, once a source of quiet pride, now presented a stark, terrifying arithmetic of dwindling fortunes. Bills arrived with increasing frequency, their polite formality replaced by the stark, unforgiving crimson of overdue notices. Yet, Elara wore a mask of serene competence, her smile a practiced shield, her words a delicate dance of reassurance.

The idea had taken root slowly, a desperate seed planted in the barren soil of her despair. She had observed the local women, the wives of tradesmen and laborers, their faces etched with the honest fatigue of hard work. They possessed a practical resilience that Elara envied, a tangible contribution to their households that she, confined by her station, had never known. Now, that confinement was a luxury she could no longer afford.

Her first foray into the working world was an exercise in profound humility. She sought out Mrs. Gable, the formidable proprietress of the village's only reputable tailor shop. Elara, her former self a distant memory, presented herself not as the lady of Blackwood Manor, but as a widow in need of honest work. Her once-delicate fingers were tasked with the arduous labor of mending garments, darning socks, and hemming trousers. The work was monotonous, the pay meager, but each coin earned felt like a victory.

But the tailor shop's earnings were not enough. Elara found herself seeking out other avenues of employment, each more physically demanding than the last. She approached the local farmer, Silas Croft, and offered her services in his fields. Tending to the fields was a brutal education. The sun beat down with relentless intensity, baking the earth and her skin. Her muscles screamed in protest as she stooped to weed, to plant, to harvest. The earth became a tangible, gritty presence beneath her fingernails. She learned the rhythms of the seasons, the satisfying ache of honest exhaustion.

Between her duties at the tailor shop and Mr. Croft's farm, Elara also took on odd jobs within the village. She would help the baker knead dough in the early hours. She would assist the laundress in scrubbing clothes, her hands raw and red from the harsh lye soap. Each task, no matter how menial, was a thread woven into the tapestry of her children's future.

The transformation was evident not just in her hands, but in her entire demeanor. The ethereal grace of the lady of Blackwood Manor was slowly being replaced by a practical, grounded strength. Her posture became straighter, her gaze more direct. Yet, beneath the surface, the same fierce maternal love burned, a constant, unwavering flame.

She would sometimes catch herself looking at her hands, flexing her fingers, and a strange sense of pride would bloom within her. These hands, once so soft and unblemished, were now a testament to her strength, her resilience, her unwavering devotion. They bore the marks of honest labor, the evidence of a battle fought and won, day by arduous day.

The soft glow of the oil lamp cast dancing shadows across the nursery walls. Elara watched her children, nestled in their beds, their faces serene in sleep, and felt a fierce, protective wave wash over her. She would sit with them for hours, her voice a soothing balm, spinning tales of valiant knights and enchanted forests, of brave explorers charting unknown lands and resilient flowers blooming in the harshest of terrains.

As they grew, so did Elara's efforts to nurture their individual strengths. Young Lyra's delicate fingers moved with an almost preternatural grace over her embroidery. She had a remarkable ability to capture the essence of things — the delicate unfurling of a fern, the defiant posture of a robin perched on a frost-kissed branch, the melancholic curve of a brow when lost in thought.

And then there was young Finn. He possessed a sharp, analytical mind, a keen eye for detail. He had a natural curiosity about how things worked, a penchant for dismantling and reassembling. He would spend hours sketching designs, his brow furrowed in concentration. His understanding of mechanics, though nascent, was impressive.

One crisp autumn afternoon, as the leaves painted the estate in hues of ochre and crimson, Elara watched Lyra and Finn return from the village. Lyra carried a small, intricately carved wooden bird, a prize she had won in a recitation contest. Finn, his face beaming, held a small, leather-bound notebook, a gift from Master Borin for his exceptional mathematical abilities.

They ran to her, their laughter echoing through the quiet grounds. "Mother," Lyra exclaimed, holding up the bird, "Master Borin said my recitation was the most beautiful he'd ever heard!" Finn, bouncing on the balls of his feet, added, "And he said my sums were faster than his own, and he gave me this!"

Elara knelt, embracing them both, her heart swelling with a gratitude so profound it threatened to bring tears to her eyes. She looked at the wooden bird, then at the notebook, and then into the bright, hopeful eyes of her children.

These were not just prizes; they were tangible proof that the seeds of opportunity, sown through her relentless sacrifices, had indeed germinated. They were the first blossoms of a future she had fought so hard to protect, a future where their potential, nurtured by her unwavering support, was finally taking flight.

The manor, with its decaying grandeur, no longer felt like a prison of their past, but a sturdy, if weathered, foundation upon which their burgeoning futures could be built.

Her victory was not proclaimed from battlements or etched in stone; it was whispered in the quiet hum of her children's minds, in the steady beat of their hopeful hearts, and in the unshakeable certainty that their lives would be, in every sense, their own.`
        }
      ]
    }
  ],
  short: [],
  poetry: [],
  other: []
};

let currentShelf = 'novels';
let currentBook = null;
let currentChapterIdx = 0;

function switchShelf(shelf) {
  currentShelf = shelf;
  document.querySelectorAll('.shelf-tab').forEach(t => {
    const isActive = t.getAttribute('onclick') === `switchShelf('${shelf}')`;
    t.style.background = isActive ? 'rgba(200,137,42,.15)' : 'transparent';
    t.style.borderColor = isActive ? 'rgba(200,137,42,.35)' : 'rgba(200,137,42,.2)';
    t.style.color = isActive ? 'var(--cream)' : 'var(--fog)';
  });
  renderBookList();
}

function renderBookList() {
  const list = $('book-list');
  if (!list) return;
  const books = LIBRARY[currentShelf] || [];
  if (!books.length) {
    list.innerHTML = `<div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.88rem;color:var(--fog);text-align:center;padding:40px 20px;opacity:.5;line-height:1.7">
      the shelves here are empty for now.<br>more stories will find their way in.
    </div>`;
    return;
  }
  list.innerHTML = books.map(b => `
    <div onclick="openBook('${b.id}')" style="background:rgba(20,14,8,.7);border:1px solid rgba(200,137,42,.18);border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .2s"
      onmouseover="this.style.borderColor='rgba(200,137,42,.4)'" onmouseout="this.style.borderColor='rgba(200,137,42,.18)'">
      <div style="font-family:'Cinzel Decorative',serif;font-size:.88rem;color:var(--cream);margin-bottom:4px;line-height:1.4">${esc(b.title)}</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.72rem;color:var(--amber);opacity:.7;margin-bottom:8px">by ${esc(b.author)} · ${esc(b.genre)}</div>
      <div style="font-family:'IM Fell English',serif;font-style:italic;font-size:.78rem;color:var(--fog);line-height:1.6">${esc(b.desc)}</div>
      <div style="margin-top:8px;font-size:.68rem;color:var(--fog);opacity:.5">${b.chapters.length} chapter${b.chapters.length!==1?'s':''}</div>
    </div>
  `).join('');
}

function openBook(id) {
  const book = Object.values(LIBRARY).flat().find(b => b.id === id);
  if (!book) return;
  currentBook = book;
  currentChapterIdx = 0;
  $('reader-title').textContent = book.title;
  buildChapterNav(book);
  renderChapter(0);
  $('library-view').style.display = 'none';
  $('reader-view').style.display = 'flex';
}

function buildChapterNav(book) {
  $('chapter-list').innerHTML = book.chapters.map((ch, i) => `
    <div onclick="goToChapter(${i});toggleChapterNav()" style="padding:6px 8px;border-radius:6px;cursor:pointer;font-family:'IM Fell English',serif;font-style:italic;font-size:.78rem;color:var(--fog);transition:all .15s;border:1px solid transparent"
      onmouseover="this.style.color='var(--cream)';this.style.borderColor='rgba(200,137,42,.2)'"
      onmouseout="this.style.color='var(--fog)';this.style.borderColor='transparent'"
      id="ch-nav-${i}">${i === 0 ? '❧' : '·'} ${esc(ch.title)}
    </div>
  `).join('');
}

function renderChapter(idx) {
  if (!currentBook) return;
  const ch = currentBook.chapters[idx];
  if (!ch) return;
  currentChapterIdx = idx;
  $('reader-chapter-label').textContent = ch.title;

  // Format paragraphs
  const paragraphs = ch.content.split('\n\n').filter(p => p.trim());
  const html = paragraphs.map(p => {
    const trimmed = p.trim();
    // Dialogue gets slightly different treatment
    if (trimmed.startsWith('"') || trimmed.startsWith('\u201c')) {
      return `<p style="margin-bottom:1.4em;color:rgba(240,230,210,.9);font-style:italic">${esc(trimmed)}</p>`;
    }
    return `<p style="margin-bottom:1.4em">${esc(trimmed)}</p>`;
  }).join('');

  $('reader-content').innerHTML = `
    <div style="font-family:'Cinzel Decorative',serif;font-size:1rem;color:var(--amber);margin-bottom:6px;line-height:1.4">${esc(ch.title)}</div>
    <div style="width:40px;height:1px;background:rgba(200,137,42,.3);margin-bottom:20px"></div>
    <div style="font-family:'Crimson Text',serif;font-size:1.05rem;color:rgba(230,220,200,.88);line-height:1.85">${html}</div>
    ${idx < currentBook.chapters.length - 1 ? `
    <div style="margin-top:32px;text-align:center">
      <button onclick="goToChapter(${idx+1})" style="background:rgba(200,137,42,.1);border:1px solid rgba(200,137,42,.3);border-radius:20px;padding:8px 24px;color:var(--cream);font-family:'IM Fell English',serif;font-style:italic;font-size:.85rem;cursor:pointer">
        next: ${esc(currentBook.chapters[idx+1].title)} →
      </button>
    </div>` : `
    <div style="margin-top:32px;text-align:center;font-family:'IM Fell English',serif;font-style:italic;font-size:.85rem;color:var(--fog);opacity:.6">— end —</div>
    <div style="margin-top:12px;text-align:center">
      <button onclick="closeReader()" style="background:transparent;border:1px solid rgba(200,137,42,.2);border-radius:20px;padding:6px 18px;color:var(--fog);font-family:'IM Fell English',serif;font-style:italic;font-size:.8rem;cursor:pointer">return to library</button>
    </div>`}
  `;
  $('reader-content').scrollTop = 0;
  updateReadProgress();
}

function goToChapter(idx) {
  renderChapter(idx);
}

function toggleChapterNav() {
  const nav = $('chapter-nav');
  nav.style.display = nav.style.display === 'none' ? 'block' : 'none';
}

function closeReader() {
  $('reader-view').style.display = 'none';
  $('library-view').style.display = 'flex';
  $('chapter-nav').style.display = 'none';
  currentBook = null;
}

function updateReadProgress() {
  const rc = $('reader-content');
  if (!rc) return;
  rc.addEventListener('scroll', () => {
    const pct = rc.scrollTop / (rc.scrollHeight - rc.clientHeight) * 100;
    const bar = $('read-progress');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }, { passive: true });
}

// Init library on castle open - renderBookList called by tryCastle

