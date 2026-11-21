// Course: Air Quality Engineering — VOC control
// Content is generic and can be used in any course on air pollution control.
(function(){
// ---- Physics: VOC balance and NIST Antoine coefficients for toluene ----
const A = 4.23679, B = 1426.448, C = -45.957; // NIST toluene, log10(Psat/bar) = A − B/(T/K + C)
const TMIN = 273.13, TMAX = 297.89, P0 = 1.01325;
const yOut = (yin, eta) => (1 - eta) * yin / (1 - eta * yin);
const Tof = p => B / (A - Math.log10(p)) - C;
const Psat = T => Math.pow(10, A - B / (T + C));

// Illustrative coolant reach: lowest gas outlet temperature each system can deliver (game assumption)
const COOLANTS = [
  {id:'cw',    name:'Cooling water',            reach:303, cost:'$'},
  {id:'chw',   name:'Chilled water',            reach:283, cost:'$$'},
  {id:'brine', name:'Brine / glycol',           reach:263, cost:'$$$'},
  {id:'ref',   name:'Mechanical refrigeration', reach:233, cost:'$$$$'},
  {id:'cryo',  name:'Cryogenic (liquid N₂)',    reach:173, cost:'$$$$$'},
];

function fmt(v){ if (v === null || v === undefined || isNaN(v)) return '?'; const a = Math.abs(v); return (a !== 0 && a < 0.001) ? v.toExponential(3) : (a >= 100 ? v.toFixed(2) : v.toPrecision(5)); }

function numSteps(yin, eta, P){
  const yo = yOut(yin, eta), ps = yo * P, T = Tof(ps);
  return [
    {type:'num', key:'yout', title:'Outlet mole fraction', unit:'–',
     prompt:`Use the VOC balance on 1 mol of inlet gas. Carrier gas stays gaseous; only toluene condenses.`,
     eq:'y<sub>out</sub> = (1 − η)·y<sub>in</sub> / (1 − η·y<sub>in</sub>)',
     answer:yo, rel:0.006,
     traps:[{id:'dilute', v:(1-eta)*yin, msg:'That is the dilute shortcut (1 − η)·y<sub>in</sub>. Removing toluene also shrinks the total outlet flow, so divide by (1 − η·y<sub>in</sub>).'}],
     hint:`Inlet: VOC = y<sub>in</sub>, carrier = 1 − y<sub>in</sub>. Outlet VOC = (1 − η)·y<sub>in</sub>, total outlet = 1 − η·y<sub>in</sub>.`},
    {type:'num', key:'psat', title:'Required vapour pressure', unit:'bar',
     prompt:`For ideal gas and pure liquid toluene, the outlet gas sits at equilibrium with the condensate.`,
     eq:'P<sub>sat</sub>(T) ≈ y<sub>out</sub>·P', answer:ps, rel:0.006,
     traps:[{id:'noP', v:yo, msg:'That is y<sub>out</sub> on its own. Multiply by the total pressure P in bar.'},
            {id:'kPa', v:yo*P*100, msg:'Units: this looks like kPa. The NIST coefficients use bar.'}],
     hint:`P = ${P} bar. Use your y<sub>out</sub> from the previous step.`},
    {type:'num', key:'T', title:'Condenser outlet temperature', unit:'K',
     prompt:`Rearrange the NIST Antoine equation for toluene to find the temperature where P<sub>sat</sub> equals your target.`,
     eq:'T = B / [A − log<sub>10</sub>(P<sub>sat</sub>)] − C &nbsp;&nbsp; A = 4.23679, B = 1426.448, C = −45.957',
     answer:T, abs:0.4,
     traps:[{id:'degC', v:T-273.15, abs:0.5, msg:'That looks like °C. Enter the temperature in kelvin.'},
            {id:'ln', v:B/(A-Math.log(ps))-C, abs:0.5, msg:'Natural log used. The NIST form uses log<sub>10</sub>.'},
            {id:'signC', v:B/(A-Math.log10(ps))+C, abs:0.5, msg:'Check the sign: T = B/[A − log<sub>10</sub>P] − C, and C is negative, so you add 45.957.'}],
     hint:'log<sub>10</sub> of a number below 1 is negative, so A − log<sub>10</sub>(P<sub>sat</sub>) is larger than A.'}
  ];
}

const coolantStep = (humid) => ({type:'coolant', key:'coolant', title:'Choose the coolant', humid,
  prompt:'Each system has a coldest gas outlet temperature it can reach. Pick the cheapest one that still hits your target.'});

// ---- Chapters ----
const CHAPTERS = [
  {id:'warm', n:'1', title:'Adsorption warm-up', lo:'Carbon capacity and the stream properties that drive technology choice', icon:'warm'},
  {id:'ox', n:'2', title:'Oxidation', lo:'Thermal and catalytic oxidation, heat recovery and catalyst sizing', icon:'oxid'},
  {id:'cond', n:'3', title:'Condensation', lo:'Condenser outlet targets from a VOC balance and vapour-pressure data', icon:'cond'},
  {id:'bio', n:'4', title:'Biological treatment', lo:'Biofilters, biotrickling filters and bioscrubbers', icon:'bio'},
  {id:'sel', n:'5', title:'Choosing a technology', lo:'Defend a technology choice with evidence and a monitoring plan', icon:'select'},
  {id:'exit', n:'6', title:'Review', lo:'Quick questions across the whole course', icon:'review'},
];

const LEVELS = [
  // ===== 0. Warm-up =====
  {id:1, ch:'warm', art:'warm', name:'Carbon check', tag:'Warm-up',
   tagline:'Usable capacity falls 25%',
   brief:'You have sized a carbon bed for a solvent vent. Humidity and ageing have cut the usable carbon capacity by 25%. The solvent load and cycle time stay the same.',
   facts:[['−25%','usable capacity'],['same','VOC load'],['same','cycle time']],
   steps:[
    {type:'num', key:'carbon', title:'How much more carbon?', unit:'× original',
     prompt:'By what factor must the carbon mass increase, all else fixed?',
     eq:'m<sub>carbon</sub> ∝ VOC load / usable capacity', answer:1/0.75, rel:0.006,
     traps:[{id:'carbon125', v:1.25, lab:'Added 25% back instead of dividing by 0.75', msg:'1.25 just adds the 25% back. Capacity is now 0.75 of the original, so mass scales by 1/0.75.'},
            {id:'carbon075', v:0.75, lab:'Reduced carbon when capacity fell', msg:'Less capacity per kilogram means you need more carbon, not less. Mass is inversely proportional to capacity.'}],
     hint:'If each kilogram now holds 0.75 of what it did, how many kilograms hold the same load?'},
    {type:'multi', key:'props', title:'What would change your recommendation?',
     prompt:'A plant has several VOC vents with different flow, concentration and composition. Which stream properties could change your control recommendation? Select all that apply.',
     options:[
      {t:'VOC concentration', ok:true}, {t:'Vapour pressure and whether the solvent is worth recovering', ok:true},
      {t:'Biodegradability', ok:true}, {t:'Compounds that could poison a catalyst', ok:true},
      {t:'Water vapour and particulates', ok:true}, {t:'How much the flow and loading vary', ok:true},
      {t:'The colour the stack is painted', ok:false, lab:'Picked an irrelevant stream property (stack colour)'}],
     okMsg:'All six matter, and each one shapes the choice: concentration and heat content in oxidation, vapour pressure in condensation, biodegradability in biological treatment.',
     missLab:'Missed stream properties that change the control choice',
     hint:'Think about what each technology needs: a fuel value, a vapour pressure, microbes, a clean catalyst.'}],
   debrief:'Carbon mass scales with 1/capacity, so a 25% capacity loss needs about 33% more carbon. When adsorption is not the best fit, the stream properties you just listed decide the alternative.'},

  // ===== 1. Oxidation =====
  {id:2, ch:'ox', art:'oxid', name:'The three Ts', tag:'Concepts',
   tagline:'Temperature, time, turbulence',
   brief:'A thermal oxidizer runs at its set temperature, yet a stack test shows poor VOC destruction. A second vent on site is a fuel-rich gas.',
   facts:[['on target','chamber temperature'],['poor','measured destruction'],['2','vents to treat']],
   steps:[
    {type:'choice', key:'hotpoor', title:'Hot but not working',
     prompt:'The chamber temperature is on target. What could still cause poor destruction?',
     options:[
      {t:'Too little residence time, poor mixing, or not enough oxygen', r:'ok', msg:'Right. Temperature is only one of the three Ts. Time and turbulence matter too, and so does oxygen availability.'},
      {t:'The temperature is too high for the VOC to react', r:'bad', lab:'Thought high temperature stops oxidation', msg:'Higher temperature speeds oxidation. Look at the other two Ts.'},
      {t:'Nothing. If the temperature is right, destruction is guaranteed', r:'bad', lab:'Believed temperature alone guarantees destruction', msg:'Temperature alone does not guarantee conversion. Residence time, mixing and oxygen all play a part.'}]},
    {type:'choice', key:'byprod', title:'What comes out?',
     prompt:'The vent gas contains a chlorinated solvent. What leaves the oxidizer?',
     options:[
      {t:'Only CO₂ and water', r:'bad', lab:'Assumed oxidation always gives only CO₂ and water', msg:'The chlorine has to go somewhere. Halogenated and sulfur-containing compounds can form acid gases.'},
      {t:'CO₂, water and acid gases such as HCl, which may need extra control downstream', r:'ok', msg:'Correct. Composition decides the byproducts, and acid gases may need a scrubber after the oxidizer.'},
      {t:'Nothing changes, because chlorinated compounds cannot be oxidized', r:'bad', lab:'Thought chlorinated VOCs cannot be oxidized', msg:'They can be oxidized. The issue is what they form.'}]},
    {type:'choice', key:'flare', title:'Flare or enclosed oxidizer?',
     prompt:'Vent 1 is a fuel-rich gas with a high heating value. Vent 2 is a large, dilute air stream with a trace of VOC. Which pairing makes sense?',
     options:[
      {t:'Flare for vent 1; enclosed thermal oxidizer with supplemental fuel and heat recovery for vent 2', r:'ok', msg:'Yes. A fuel-rich gas can burn at a flare tip. A dilute air stream needs a controlled chamber and supporting fuel.'},
      {t:'Flare for vent 2, because it will burn on its own', r:'bad', lab:'Expected a dilute air stream to sustain a flare', msg:'A dilute air stream has too little heating value to sustain stable combustion at a burner tip.'},
      {t:'Either option works the same for both vents', r:'bad', lab:'Ignored heating value and flow stability', msg:'Gas heating value and flow stability shape the choice.'}]}],
   debrief:'Temperature, time and turbulence work together, oxygen must be available, and composition decides the byproducts. Heating value and flow stability decide between a flare and an enclosed oxidizer.'},

  {id:3, ch:'ox', art:'oxid', name:'Heat recovery', tag:'Concepts',
   tagline:'Recuperative vs regenerative',
   brief:'The dilute stream needs supplemental fuel to reach operating temperature. Management wants the fuel bill down without losing performance.',
   facts:[['dilute','VOC stream'],['high','fuel use'],['2','recovery options']],
   steps:[
    {type:'choice', key:'whyhr', title:'Why recover heat?',
     prompt:'What does heat recovery actually do for this oxidizer?',
     options:[
      {t:'Hot exhaust preheats the incoming gas, so less supplemental fuel is needed', r:'ok', msg:'Exactly. Recovered heat lowers supplemental fuel demand.'},
      {t:'It guarantees 100% destruction', r:'bad', lab:'Thought heat recovery guarantees complete destruction', msg:'Heat recovery saves fuel. It does not by itself guarantee destruction.'},
      {t:'It removes the need to monitor temperature', r:'bad', lab:'Thought heat recovery removes the need for monitoring', msg:'Monitoring is still needed. Recovery equipment can foul or leak during switching.'}]},
    {type:'match', key:'hrtype', title:'Recuperative or regenerative?',
     prompt:'Match each description to the type of heat recovery.',
     choices:['Recuperative','Regenerative'],
     items:[
      {t:'Hot exhaust heats the inlet gas through a separating wall', ans:'Recuperative'},
      {t:'Ceramic beds store heat, and valves reverse the flow so the beds swap roles', ans:'Regenerative'},
      {t:'Works like two thermal batteries that take turns charging and discharging', ans:'Regenerative'},
      {t:'Fouling of the heat-exchange surface limits performance', ans:'Recuperative'}],
     okMsg:'All matched. A recuperator transfers heat across a surface. A regenerator stores it in beds and reverses the flow.',
     lab:'Mixed up recuperative and regenerative heat recovery'},
    {type:'choice', key:'mix', title:'Trace the gas paths',
     prompt:'In a recuperative heat exchanger, do the inlet gas and the hot exhaust mix?',
     options:[
      {t:'No. Heat crosses the surface without the streams intentionally mixing', r:'ok', msg:'Right. The two gas paths stay separate.'},
      {t:'Yes. They mix so heat transfers faster', r:'bad', lab:'Thought the gas streams in a recuperator mix', msg:'Mixing would send untreated gas straight to the stack. The surface keeps the paths apart.'}]}],
   debrief:'Recuperative recovery passes heat through a surface. Regenerative recovery stores heat in beds and swaps them by reversing the flow. Both cut fuel use, and neither has a fixed efficiency independent of design.'},

  {id:4, ch:'ox', art:'cat', name:'Catalytic oxidation', tag:'Concepts',
   tagline:'Lower temperature, more conditions',
   brief:'A vendor offers a catalytic oxidizer: oxidation at a lower temperature than a thermal unit, so a smaller fuel bill. Before you sign, check the catalyst will actually suit this gas.',
   facts:[['lower','operating temperature'],['?','gas compatibility'],['?','vendor guarantee']],
   steps:[
    {type:'multi', key:'catinfo', title:'Before you trust the promise',
     prompt:'What information would you ask for before accepting a catalyst performance promise? Select all that apply.',
     options:[
      {t:'The full VOC mixture composition', ok:true}, {t:'Particulates in the gas', ok:true},
      {t:'Compounds that could poison the catalyst', ok:true}, {t:'The inlet temperature range', ok:true},
      {t:'How much the loading varies', ok:true},
      {t:'Nothing, since catalysts work for every VOC', ok:false, lab:'Assumed a catalyst suits every VOC'}],
     okMsg:'Good list. Activity depends on the catalyst, the VOC and the rest of the gas composition.',
     missLab:'Missed information needed before trusting a catalyst',
     hint:'What could block the surface, change its chemistry, or push it outside its working window?'},
    {type:'match', key:'catfault', title:'Name the fault',
     prompt:'Match each symptom to the cause of performance loss.',
     choices:['Fouling or masking','Poisoning','Thermal aging'],
     items:[
      {t:'Dust coats the surface and blocks access to active sites', ans:'Fouling or masking'},
      {t:'A compound in the gas chemically changes the catalyst’s activity', ans:'Poisoning'},
      {t:'Repeated overheating slowly degrades the catalyst', ans:'Thermal aging'}],
     okMsg:'Correct. Fouling obstructs access, poisoning changes activity, and thermal aging degrades the catalyst over time.',
     lab:'Confused fouling, poisoning and thermal aging'},
    {type:'choice', key:'hotter', title:'Just turn up the heat?',
     prompt:'Conversion has dropped. An operator suggests raising the bed temperature. Will that always fix it?',
     options:[
      {t:'No. Overheating can damage the catalyst, and it does not remove every poison', r:'ok', msg:'Right. Diagnose the cause first.'},
      {t:'Yes. More heat always restores activity', r:'bad', lab:'Thought raising temperature always fixes a catalyst', msg:'Extra heat can cause thermal aging and will not undo chemical poisoning.'}]}],
   debrief:'A catalyst lowers the operating temperature, but only if it suits the gas. Ask about composition, particulates, poisons, inlet temperature and loading before you promise performance.'},

  {id:5, ch:'ox', art:'cat', name:'Space velocity', tag:'Calculation',
   tagline:'Q = 12,000 std m³/h · SV = 30,000 h⁻¹',
   brief:'Size a catalyst bed for a 12,000 std m³/h vent, then check what happens when the plant grows. Finish by choosing what to monitor.',
   facts:[['12,000','Q, std m³/h'],['30,000 h⁻¹','space velocity'],['?','bed volume']],
   steps:[
    {type:'num', key:'vcat', title:'Catalyst bed volume', unit:'m³',
     prompt:'Use the space velocity definition to size the catalyst bed.',
     eq:'SV = Q<sub>standard</sub> / V<sub>catalyst</sub> &nbsp;→&nbsp; V<sub>catalyst</sub> = Q / SV', answer:0.4, rel:0.006,
     traps:[{id:'svInvert', v:2.5, lab:'Inverted the space velocity equation', msg:'That is SV/Q. Rearrange: V = Q / SV = 12,000 / 30,000.'},
            {id:'svUnits', v:400, lab:'Unit slip in the space velocity calculation', msg:'Check the units: (m³/h) ÷ (h⁻¹) gives m³ directly.'}],
     hint:'Divide the standard flow by the space velocity. The hours cancel.'},
    {type:'num', key:'vcat2', title:'The plant expands', unit:'m³',
     prompt:'Flow rises to 18,000 standard m³/h. Keeping SV = 30,000 h⁻¹, what bed volume do you need now?',
     eq:'V<sub>catalyst</sub> = Q / SV', answer:0.6, rel:0.006,
     traps:[{id:'svInvert', v:30000/18000, lab:'Inverted the space velocity equation', msg:'That is SV/Q. Rearrange: V = Q / SV = 18,000 / 30,000.'}],
     hint:'Same equation, new flow.'},
    {type:'choice', key:'svdouble', title:'Flow doubles, same bed',
     prompt:'Back to the 0.400 m³ bed. If the gas flow doubles, what happens?',
     options:[
      {t:'SV doubles, so the gas has less contact with the catalyst', r:'ok', msg:'Correct. SV and contact are inversely related.'},
      {t:'SV halves, so contact increases', r:'bad', lab:'Thought higher flow lowers space velocity', msg:'SV = Q/V. Double Q at fixed V and SV doubles.'},
      {t:'Nothing changes, because the bed is the same size', r:'bad', lab:'Thought space velocity is set by the bed alone', msg:'SV depends on both the flow and the bed volume.'}]},
    {type:'choice', key:'res', title:'Is 1/SV the residence time?',
     prompt:'Is 1/SV the actual residence time of the hot gas in the bed?',
     options:[
      {t:'No. It is based on standard flow; hot gas expands, and void fraction and contact conventions matter', r:'ok', msg:'Right. 1/SV is a standard-flow convention, not the true hot-gas residence time.'},
      {t:'Yes. 1/SV is always the true residence time', r:'bad', lab:'Took 1/SV as the true hot-gas residence time', msg:'Actual gas flow changes with temperature and pressure, so 1/SV is only a proxy.'}]},
    {type:'multi', key:'oxmon', title:'Prove it is working',
     prompt:'Which measurements show how a catalytic oxidizer is actually performing? Select all that apply.',
     options:[
      {t:'Outlet VOC concentration', ok:true}, {t:'Catalyst bed inlet temperature', ok:true},
      {t:'Temperature rise across the bed, as a sign of activity', ok:true},
      {t:'Chamber temperature alone, as proof of compliance', ok:false, lab:'Treated temperature alone as proof of compliance'}],
     okMsg:'Good. Outlet VOC is the direct evidence; bed temperatures help diagnose why it changes.',
     missLab:'Missed key oxidizer monitoring variables',
     hint:'One measurement is direct evidence of treatment. The others help explain it.'}],
   debrief:'SV = Q/V, so V = 12,000/30,000 = 0.400 m³, and 0.600 m³ at 18,000 m³/h. More flow through the same bed means higher SV and less contact. Outlet VOC is the direct performance evidence; temperature alone does not prove compliance.'},

  // ===== 2. Condensation (existing levels) =====
  {id:6, ch:'cond', art:'cond', kind:'cond', name:'The worked case', tag:'Guided', yin:0.100, eta:0.900, P:P0, gas:'Dry air', flow:'12,000 m³/h',
   brief:'A coating line vents toluene in dry air. The permit requires 90% of the toluene to be recovered as liquid. This is the guided worked example.',
   debrief:'Flow rate sets the cooling duty and exchanger size, but not this equilibrium target. That is why it never entered your calculation.'},
  {id:7, ch:'cond', art:'cond', kind:'cond', name:'Warmer target', tag:'Practice', yin:0.150, eta:0.850, P:P0, gas:'Dry air', flow:'8,000 m³/h',
   brief:'A richer solvent stream with a looser target. See whether you still need the expensive coolant.',
   debrief:'A richer inlet and a looser target raise the allowable P<sub>sat</sub>, so a warmer and cheaper coolant does the job.'},
  {id:8, ch:'cond', art:'cond', kind:'cond', variant:'wall', name:'The validity wall', tag:'Challenge', yin:0.100, eta:0.990, P:P0, gas:'Dry air', flow:'12,000 m³/h',
   brief:'The regulator tightens the target to 99% recovery. Same stream as the worked case. Do the numbers still hold up?',
   debrief:'Recovering the last few percent needs much colder operation, and these coefficients cannot support a result below 273.13 K. Report the limit, then find valid data or add a polishing step.'},
  {id:9, ch:'cond', art:'cond', kind:'cond', variant:'wet', name:'Wet gas', tag:'Challenge', yin:0.100, eta:0.915, P:P0, gas:'Humid air (near saturated)', flow:'12,000 m³/h',
   brief:'The exhaust now comes from a wet scrubbing step and carries a lot of water vapour. The target is 91.5% recovery.',
   debrief:'Brine walls run below 0 °C. Water freezes on the tubes, blocks the gas path and kills heat transfer. A warmer first stage removes most of the water before the deep-cooling stage.'},
  {id:10, ch:'cond', art:'cond', kind:'cond', variant:'dilute', name:'Right tool?', tag:'Selection', yin:0.0003, eta:0.950, P:P0, gas:'Dry air, 300 ppmv toluene', flow:'40,000 m³/h',
   brief:'A large, dilute ventilation exhaust with 300 ppmv toluene needs 95% removal. Before you design a condenser, check whether one makes sense.',
   debrief:'At low concentration the required vapour pressure is tiny. Condensation would need cryogenic temperatures on a huge flow. Adsorption or oxidation fits this stream far better.'},

  // ===== 3. Biological treatment =====
  {id:11, ch:'bio', art:'bio', name:'Biofilter', tag:'Diagnosis',
   tagline:'Media dries, outlet VOC rises',
   brief:'A dilute, biodegradable VOC stream passes through a packed biofilter. After a hot, dry week, outlet VOC is creeping up.',
   facts:[['dilute','biodegradable VOC'],['rising','outlet VOC'],['hot, dry','last week']],
   steps:[
    {type:'choice', key:'biodiff', title:'What makes biology different?',
     prompt:'Which limitation applies to biological treatment but not to thermal oxidation?',
     options:[
      {t:'It relies on living microbes: acclimation, inhibition and transfer of VOC into the moist biofilm', r:'ok', msg:'Right. Performance depends on microbial activity and on getting the VOC into the biofilm.'},
      {t:'It needs a very high combustion temperature', r:'bad', lab:'Confused biological treatment with combustion', msg:'That describes thermal oxidation, not biology.'},
      {t:'It can only treat inorganic gases', r:'bad', lab:'Thought biological systems only treat inorganic gases', msg:'Biological systems treat many biodegradable VOCs. Don’t confuse VOC treatment with H₂S odour control.'}]},
    {type:'multi', key:'bfcheck', title:'Diagnose before you fix',
     prompt:'The media may have dried. What should you check? Select all that apply.',
     options:[
      {t:'Inlet humidification', ok:true}, {t:'Media moisture content', ok:true},
      {t:'Gas distribution and channeling', ok:true}, {t:'Pressure drop across the bed', ok:true},
      {t:'VOC loading and temperature', ok:true},
      {t:'Replace all the media straight away', ok:false, lab:'Jumped to a corrective action before diagnosing'}],
     okMsg:'Good. Those are diagnostic checks. Replacing media is a corrective action, and you decide on it only after confirming the fault.',
     missLab:'Missed biofilter diagnostic checks',
     hint:'One of these is a fix, not a check.'},
    {type:'choice', key:'bfnext', title:'Fault confirmed',
     prompt:'Moisture readings confirm the media has dried out. What is the defensible next step?',
     options:[
      {t:'Restore humidification and media moisture, then track outlet VOC and pressure drop as activity recovers', r:'ok', msg:'Yes. Fix the confirmed cause, then verify with outlet VOC.'},
      {t:'Double the gas flow to push more VOC through', r:'mid', lab:'Increased loading on a stressed biofilter', msg:'More loading on stressed microbes will push outlet VOC higher.'},
      {t:'Feed hotter gas to speed the microbes up', r:'bad', lab:'Proposed heating a dried-out biofilter', msg:'Hotter gas dries the media further and can harm the microbes.'}]}],
   debrief:'Moisture keeps a biofilter alive. Drying, channeling and high pressure drop impair treatment. Diagnose with humidification, moisture, distribution, pressure drop and loading before changing anything.'},

  {id:12, ch:'bio', art:'bio', name:'Biotrickling filter', tag:'Concepts',
   tagline:'Recirculating liquid, more control',
   brief:'The site is considering a biotrickling filter instead: biofilm on packing, with a recirculating liquid trickling over it.',
   facts:[['packing','biofilm support'],['recirculating','liquid'],['?','what you can control']],
   steps:[
    {type:'multi', key:'btfvars', title:'More knobs to turn',
     prompt:'Compared with a simple biofilter, which variables become easier to control? Select all that apply.',
     options:[
      {t:'Liquid recirculation flow', ok:true}, {t:'pH', ok:true}, {t:'Nutrient dosing', ok:true},
      {t:'Combustion temperature', ok:false, lab:'Picked combustion temperature for a biological reactor'},
      {t:'Catalyst space velocity', ok:false, lab:'Picked catalyst space velocity for a biological reactor'}],
     okMsg:'Right. The recirculating liquid supplies moisture and nutrients and helps control chemistry.',
     missLab:'Missed controllable variables in a biotrickling filter',
     hint:'Everything you can change arrives in the liquid.'},
    {type:'choice', key:'btfrisk', title:'Typical problem',
     prompt:'Which operating problem is more typical of a biotrickling filter?',
     options:[
      {t:'Excess biomass build-up and liquid management', r:'ok', msg:'Yes. Biomass can clog the packing, and the liquid has to be managed.'},
      {t:'Catalyst poisoning', r:'bad', lab:'Expected catalyst poisoning in a biological reactor', msg:'There is no catalyst here. The biology is the active part.'},
      {t:'Ice forming on cold tubes', r:'bad', lab:'Expected icing in a biological reactor', msg:'That is a condenser problem.'}]},
    {type:'choice', key:'btfrange', title:'Universal limits?',
     prompt:'Some references quote 16–29 °C and pH 6–8 for biological treatment. Are these universal limits for every biological system?',
     options:[
      {t:'No. They are illustrative for some mesophilic systems; conditions depend on the organisms and the pollutant', r:'ok', msg:'Correct. Treat them as examples, not rules.'},
      {t:'Yes. Every biological system must stay inside that range', r:'bad', lab:'Treated illustrative pH and temperature ranges as universal', msg:'Conditions depend on the organisms and the pollutant.'}]}],
   debrief:'A biotrickling filter keeps the biofilm on packing but adds a recirculating liquid, so liquid flow, pH and nutrients become controllable. Excess biomass and liquid management are its typical problems.'},

  {id:13, ch:'bio', art:'bio', name:'Bioscrubber', tag:'Concepts',
   tagline:'Where does the biology happen?',
   brief:'A third option: a bioscrubber. Pin down where the biological activity happens in each of the three reactor types.',
   facts:[['3','reactor types'],['absorber','gas–liquid contact'],['separate','bioreactor']],
   steps:[
    {type:'match', key:'bioloc', title:'Locate the biology',
     prompt:'Where does the main biological activity happen in each reactor?',
     choices:['In moist packed media','In biofilm on packing wetted by recirculating liquid','In a separate liquid-phase bioreactor'],
     items:[
      {t:'Biofilter', ans:'In moist packed media'},
      {t:'Biotrickling filter', ans:'In biofilm on packing wetted by recirculating liquid'},
      {t:'Bioscrubber', ans:'In a separate liquid-phase bioreactor'}],
     okMsg:'All three located. In a bioscrubber, the absorber transfers VOC into liquid, and a separate vessel does the biodegradation.',
     lab:'Misplaced the biological activity in the three reactor types'},
    {type:'choice', key:'hydro', title:'A poorly soluble VOC',
     prompt:'A bioscrubber is proposed for a hydrophobic, poorly water-soluble VOC. What is the main concern?',
     options:[
      {t:'Gas-to-liquid transfer in the absorber may limit removal', r:'ok', msg:'Right. If the VOC barely dissolves, the microbes never see it.'},
      {t:'Microbes cannot survive in a separate vessel', r:'bad', lab:'Thought microbes cannot live in a separate bioreactor', msg:'The separate bioreactor is designed for them. The problem is upstream.'},
      {t:'None. Solubility does not matter', r:'bad', lab:'Ignored solubility in a bioscrubber', msg:'Solubility controls how much VOC reaches the liquid.'}]}],
   debrief:'Biofilter: activity in moist media. Biotrickling filter: biofilm on packing with recirculating liquid. Bioscrubber: absorber plus a separate liquid-phase bioreactor, so poorly soluble VOCs can be transfer-limited.'},

  // ===== 4. Choosing a technology =====
  {id:14, ch:'sel', art:'select', name:'Case A', tag:'Decision',
   tagline:'Recoverable solvent, high and steady',
   brief:'Case A: a recoverable solvent at high, steady concentration, with limited water in the gas.',
   facts:[['high, steady','concentration'],['valuable','solvent'],['limited','water']],
   steps:[
    {type:'choice', key:'caseA', title:'Recommend a control',
     prompt:'Which control or treatment train fits Case A best?',
     options:[
      {t:'Condensation for bulk recovery, with adsorption polishing the outlet', r:'ok', msg:'Good choice. Favourable vapour pressure means you can recover the solvent, and polishing meets a tight outlet target.'},
      {t:'Thermal oxidation', r:'mid', lab:'Chose to destroy a recoverable solvent (Case A)', msg:'It would work, but it burns a solvent you could recover, and the fuel bill follows.'},
      {t:'A biofilter', r:'bad', lab:'Chose a biofilter for a concentrated solvent (Case A)', msg:'High concentration risks inhibiting the microbes, and you lose the solvent.'}]},
    {type:'multi', key:'monA', title:'Monitoring plan',
     prompt:'Which variables would you monitor for the condenser plus polishing train? Select all that apply.',
     options:[
      {t:'Outlet VOC after the polishing stage', ok:true}, {t:'Condenser outlet temperature', ok:true},
      {t:'Coolant performance: supply temperature and flow', ok:true},
      {t:'Biofilter media moisture', ok:false, lab:'Picked monitoring from the wrong technology'}],
     okMsg:'Right. Outlet VOC is the evidence; condenser temperature and coolant explain changes.',
     missLab:'Missed condenser monitoring variables',
     hint:'Pick the direct evidence, plus what explains a change in it.'},
    {type:'choice', key:'missA', title:'What could change your mind?',
     prompt:'Which missing information would most change this recommendation?',
     options:[
      {t:'Vapour-pressure data valid at the target temperature, and the real water content', r:'ok', msg:'Yes. Without valid property data and water content, you can’t confirm the condenser target or the icing risk.'},
      {t:'The brand of the coolant pump', r:'bad', lab:'Named irrelevant missing information (Case A)', msg:'That doesn’t change the technology choice.'}]}],
   debrief:'Recovery and a favourable vapour pressure point to condensation, with polishing for the last part of the target. Back the choice with stream data and verify it by measuring outlet VOC.'},

  {id:15, ch:'sel', art:'select', name:'Case B', tag:'Decision',
   tagline:'Dilute, biodegradable, humid',
   brief:'Case B: a dilute, biodegradable VOC in humid air, with steady, moderate loading.',
   facts:[['dilute','concentration'],['biodegradable','VOC'],['humid','air']],
   steps:[
    {type:'choice', key:'caseB', title:'Recommend a control',
     prompt:'Which control fits Case B best?',
     options:[
      {t:'Biological treatment: a biofilter or a biotrickling filter', r:'ok', msg:'Good fit. Biodegradable, steady, moderate loading and humid air suit biology.'},
      {t:'Carbon adsorption', r:'mid', lab:'Chose adsorption for a humid stream (Case B)', msg:'Possible, but humidity competes for carbon capacity, and there is nothing worth recovering.'},
      {t:'Condensation', r:'bad', lab:'Chose condensation for a dilute stream (Case B)', msg:'The required vapour pressure would be tiny, and the humidity would ice the exchanger.'}]},
    {type:'multi', key:'monB', title:'Monitoring plan',
     prompt:'Which variables would you monitor for the biological system? Select all that apply.',
     options:[
      {t:'Outlet VOC', ok:true}, {t:'Media or liquid conditions: moisture, pH, nutrients', ok:true}, {t:'Pressure drop', ok:true},
      {t:'Combustion chamber temperature', ok:false, lab:'Picked monitoring from the wrong technology'}],
     okMsg:'Right. Outlet VOC, media or liquid conditions and pressure drop.',
     missLab:'Missed biological monitoring variables',
     hint:'What keeps microbes working, and what shows clogging?'}],
   debrief:'A dilute, biodegradable, humid, steady stream is where biological treatment shines. Monitor outlet VOC, media or liquid conditions and pressure drop.'},

  {id:16, ch:'sel', art:'select', name:'Case C', tag:'Decision',
   tagline:'Variable mixed solvents, poisons suspected',
   brief:'Case C: a variable mixed-solvent vent, and catalyst poisons are suspected.',
   facts:[['variable','flow and loading'],['mixed','solvents'],['suspected','catalyst poisons']],
   steps:[
    {type:'choice', key:'caseC', title:'Recommend a control',
     prompt:'Which control fits Case C best?',
     options:[
      {t:'Thermal oxidation, or pretreatment plus catalytic oxidation only after compatibility checks', r:'ok', msg:'Defensible. Thermal oxidation tolerates a mixed, variable feed; a catalyst needs its compatibility confirmed first.'},
      {t:'Catalytic oxidation as it stands', r:'bad', lab:'Chose catalytic oxidation despite suspected poisons (Case C)', msg:'Suspected poisons could kill the catalyst. Check compatibility or pretreat first.'},
      {t:'A biofilter', r:'mid', lab:'Chose a biofilter for a variable mixed vent (Case C)', msg:'Variable loading and mixed solvents make stable biology hard to keep.'}]},
    {type:'multi', key:'monC', title:'Monitoring plan',
     prompt:'Which variables would you monitor for a thermal oxidizer on this vent? Select all that apply.',
     options:[
      {t:'Outlet VOC', ok:true}, {t:'Combustion chamber temperature', ok:true}, {t:'Inlet composition and loading variability', ok:true},
      {t:'Condenser coolant flow', ok:false, lab:'Picked monitoring from the wrong technology'}],
     okMsg:'Good. Outlet VOC is the evidence; chamber temperature and inlet variability explain changes.',
     missLab:'Missed oxidizer monitoring variables',
     hint:'Direct evidence, the operating condition, and what makes this vent difficult.'}],
   debrief:'With a variable, mixed vent and suspected poisons, thermal oxidation is the robust choice. A catalytic route needs compatibility checks or pretreatment first. Other answers can be defended if the assumptions are stated.'},

  {id:17, ch:'sel', art:'cond', kind:'orig99', name:'The 99% challenge', tag:'Critical thinking',
   yin:0.005, eta:0.99, P:P0, gas:'Air, 1 atm', flow:'1,000 scfm',
   brief:'A classic textbook-style problem: y<sub>in</sub> = 0.005, η = 0.99, P = 1 atm. Work it through, then decide what you can honestly claim.',
   debrief:'The balance gives about 50 ppmv at the outlet and a required P<sub>sat</sub> near 5.1 × 10⁻⁵ bar. The NIST coefficient range cannot validate that low temperature, so you need valid low-temperature data plus mixture, icing and heat-duty checks.'},

  // ===== 5. Exit ticket =====
  {id:18, ch:'exit', art:'select', name:'Final check', tag:'Review',
   tagline:'Three questions across the course',
   brief:'Three quick questions that bring the course together. Answer on your own.',
   facts:[['3','questions'],['LO1–LO4','covered'],['on your own','no notes']],
   steps:[
    {type:'choice', key:'ex1', title:'Question 1',
     prompt:'Why can a high removal fraction require a very low condenser temperature?',
     options:[
      {t:'The allowed VOC partial pressure at the outlet falls, so P<sub>sat</sub> must be lower, which needs a colder temperature', r:'ok', msg:'Exactly. A tighter target means a lower outlet partial pressure.'},
      {t:'Because the gas flow rate increases', r:'bad', lab:'Linked condenser temperature to flow rate', msg:'Flow sets the duty and size, not the equilibrium temperature.'},
      {t:'Because the coolant warms up', r:'bad', lab:'Linked condenser temperature to coolant warming', msg:'The target comes from the outlet vapour pressure, not the coolant.'}]},
    {type:'choice', key:'ex2', title:'Question 2',
     prompt:'Give one reason a catalyst may fail despite a suitable inlet temperature.',
     options:[
      {t:'Poisoning, masking, fouling or thermal aging', r:'ok', msg:'Right. Temperature is necessary but not sufficient.'},
      {t:'The space velocity was too low', r:'bad', lab:'Blamed low space velocity for catalyst failure', msg:'A low SV means more contact, which helps conversion.'},
      {t:'It can’t fail if the temperature is suitable', r:'bad', lab:'Believed a suitable temperature prevents catalyst failure', msg:'Poisons and fouling act regardless of temperature.'}]},
    {type:'choice', key:'ex3', title:'Question 3',
     prompt:'Which monitoring set fits a biofilter?',
     options:[
      {t:'Outlet VOC, media moisture or liquid conditions, and pressure drop', r:'ok', msg:'Correct.'},
      {t:'Chamber temperature only', r:'bad', lab:'Picked oxidizer monitoring for a biofilter', msg:'That is for oxidizers, and temperature alone never proves compliance.'},
      {t:'Coolant flow and outlet temperature', r:'bad', lab:'Picked condenser monitoring for a biofilter', msg:'That is for condensers.'}]}],
   debrief:'Tighter targets mean lower outlet vapour pressure, catalysts fail through poisoning, fouling or aging, and every technology is verified by outlet VOC plus the variables that explain it.'},
];

function buildSteps(L){
  if (Array.isArray(L.steps)) return L.steps;
  const base = numSteps(L.yin, L.eta, L.P);
  const yo = yOut(L.yin, L.eta), T = Tof(yo*L.P);
  if (L.kind === 'orig99') return [base[0], base[1],
    {type:'choice', key:'orig99', title:'What can you claim?',
     prompt:`Your target P<sub>sat</sub> is about ${fmt(yo*L.P)} bar, far below the ${fmt(Psat(TMIN))} bar at the bottom of the NIST range. What do you need before stating a condenser temperature?`,
     options:[
      {t:'Validated low-temperature vapour-pressure data, plus mixture, icing and heat-duty checks', r:'ok', msg:'Right. This is a data-validity answer, and it’s the honest one.'},
      {t:'Extrapolate the NIST equation, since it’s close enough', r:'bad', lab:'Extrapolated Antoine beyond its range', msg:'It isn’t close: the target is far outside the fitted range.'},
      {t:'Use the dilute shortcut instead', r:'bad', lab:'Thought the dilute shortcut fixes data validity', msg:'The shortcut changes the balance slightly; it doesn’t fix the property data.'}]}];
  if (!L.variant) return [...base, coolantStep(false)];
  if (L.variant === 'wall'){
    const etaMax = (() => { const y = Psat(TMIN)/L.P; return (L.yin - y)/(L.yin*(1 - y)); })();
    return [...base,
      {type:'choice', key:'valid', title:'Check the property data',
       prompt:`You got about ${T.toFixed(1)} K. The NIST coefficient set is valid from 273.13 to 297.89 K. Can you report this temperature?`,
       options:[
         {t:'Yes. The equation gives a number, so it is fine.', r:'bad', lab:'Accepted an extrapolated Antoine result', msg:'The equation will always return a number. Outside its fitted range the result has no support, so this temperature cannot be defended.'},
         {t:'No. The result is below the valid range, so it is an extrapolation.', r:'ok', msg:'Correct. 244 K is about 29 K below the lowest temperature these coefficients were fitted for.'},
         {t:'Yes, as long as I convert it to °C first.', r:'bad', lab:'Thought unit conversion fixes validity', msg:'Units don’t change the validity range. It is still an extrapolation.'}]},
      {type:'num', key:'etamax', title:'What can you defend?', unit:'–',
       prompt:'At the bottom of the valid range (273.13 K), what is the highest recovery fraction η you can defend with these coefficients?',
       eq:'P<sub>sat</sub>(273.13 K) → y<sub>out</sub> = P<sub>sat</sub>/P → η = (y<sub>in</sub> − y<sub>out</sub>) / [y<sub>in</sub>(1 − y<sub>out</sub>)]',
       answer:etaMax, rel:0.006, traps:[],
       hint:'P<sub>sat</sub> = 10^(A − B/(T + C)) with T = 273.13 K. Then rearrange the balance for η.'},
      {type:'choice', key:'next', title:'Your recommendation',
       prompt:'The condenser alone cannot be shown to reach 99% with this data. What do you recommend?',
       options:[
         {t:'Design for 244 K anyway and add a safety margin.', r:'bad', lab:'Added margin to an unsupported number', msg:'A margin on an unsupported number is still unsupported. Fix the data first.'},
         {t:'Find coefficients valid at lower temperature and recheck, or use the condenser for bulk recovery with an adsorber polishing the outlet.', r:'ok', msg:'That is the defensible route. A condenser plus a polishing stage is a common treatment train.'},
         {t:'Drop the condenser and vent the stream.', r:'bad', lab:'Proposed venting the stream', msg:'The permit still applies. Venting does not meet the target.'}]}
    ];
  }
  if (L.variant === 'wet'){
    return [...base, coolantStep(true),
      {type:'choice', key:'arrange', title:'Exchanger arrangement',
       prompt:'Your brine-cooled tube walls will sit below 0 °C, and the gas is full of water vapour. How do you arrange the condenser?',
       options:[
         {t:'One surface condenser on brine, straight in.', r:'bad', frost:true, lab:'Ignored icing with wet gas', msg:'Ice builds on the tubes within hours. Pressure drop climbs and recovery falls. Watch the schematic.'},
         {t:'Two stages: a chilled-water pre-cooler knocks out water, then the brine condenser, with a spare train to defrost.', r:'ok', msg:'Staged cooling removes most of the water above freezing, and the second train lets you defrost without stopping.'},
         {t:'Direct contact: spray brine into the gas.', r:'mid', lab:'Chose direct contact (mixed liquid)', msg:'It avoids icing on tubes, but now toluene, water and brine leave as one mixed liquid. Recovering clean solvent gets hard.'}]}
    ];
  }
  if (L.variant === 'dilute'){
    return [base[0], base[1],
      {type:'choice', key:'feasible', title:'Is condensation sensible?',
       prompt:`Your target P<sub>sat</sub> is about ${fmt(yo*L.P)} bar. The lowest value inside the valid range is ${fmt(Psat(TMIN))} bar at 273.13 K. What does that tell you?`,
       options:[
         {t:'Fine. Use cryogenic cooling and condense it.', r:'mid', lab:'Chose cryogenic cooling for a dilute stream', msg:'Physically possible, but cooling 40,000 m³/h of air to cryogenic temperatures to catch a trace of solvent is enormously expensive.'},
         {t:'The required P<sub>sat</sub> is hundreds of times below the valid range. Condensation is a poor fit as the main control.', r:'ok', msg:'Right. The stream is too dilute for condensation to be practical.'},
         {t:'Use chilled water. It should be cold enough.', r:'bad', lab:'Thought chilled water suits a dilute stream', msg:'Chilled water gets to roughly 283 K. The required vapour pressure is far below anything near that.'}]},
      {type:'choice', key:'tech', title:'Choose the technology',
       prompt:'Which primary control fits a large, dilute, dry toluene stream best?',
       options:[
         {t:'Carbon adsorption, with solvent recovery on regeneration', r:'ok', msg:'Good fit. Adsorption works well on dilute streams and still recovers solvent.'},
         {t:'Regenerative or catalytic oxidation', r:'ok', msg:'Good fit. Heat recovery keeps fuel use low at this concentration.'},
         {t:'A refrigerated condenser', r:'bad', lab:'Picked a condenser for a dilute stream', msg:'See the previous step. It cannot reach the target at a sensible cost.'}]}
    ];
  }
}

// ---- State ----

window.COURSES = window.COURSES || {};
window.COURSES['air-quality'] = {
  id:'air-quality', title:'Air Quality Engineering', field:'Environmental engineering',
  blurb:'Control volatile organic compounds: adsorption, oxidation, condensation and biological treatment, then choose and defend a technology.',
  chapters:CHAPTERS, levels:LEVELS, buildSteps, coolants:COOLANTS,
  labels:{
    dilute:'Used the dilute shortcut (1 − η)·y_in', noP:'Forgot to multiply y_out by total pressure', kPa:'Gave P_sat in kPa instead of bar',
    degC:'Gave temperature in °C instead of K', ln:'Used ln instead of log10', signC:'Wrong sign on Antoine constant C',
    'coolant-weak':'Picked a coolant too warm for the target', 'coolant-overkill':'Over-specified the coolant (extra cost)'
  },
  physics:{A, B, C, TMIN, TMAX, P0, yOut, Tof, Psat}
};
})();
