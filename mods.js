let gimmicks = {};
let globalMods = {};
let modWeight = {};
let globalModIndex = 0;

function addGlobalMod(name, weight) {
    let i = globalModIndex;
    if (i >= 128) return;
    globalModIndex++;

    globalMods[name] = i;
    modWeight[name] = weight;
}

function addGimmick(name, extraMods) {
    let gimmick = {extraMods: {}};
    let index = 0;
    for (let mod of extraMods) {
        gimmick.extraMods[mod[0]] = index | 128;
        modWeight[mod[0]] = mod[1] ?? 1;
        index++;
    }
    gimmicks[name] = gimmick;
}

addGlobalMod("unknown", 0);
addGlobalMod("prx", 2);
addGlobalMod("prxb", 2);
addGlobalMod("prxc", 2);
addGlobalMod("pry", 2);
addGlobalMod("pryb", 2);
addGlobalMod("pryc", 2);
addGlobalMod("prsx", 2);
addGlobalMod("pra", 2);
addGlobalMod("przm", 2);
addGlobalMod("przmb", 2);
addGlobalMod("przx", 2);
addGlobalMod("przy", 2);
addGlobalMod("prrx", 2);
addGlobalMod("prry", 2);
addGlobalMod("prrz", 2);
addGlobalMod("prrzb", 2);
addGlobalMod("shxs", 1.5);
addGlobalMod("shxp", 1.5);
addGlobalMod("shxa", 1.5);
addGlobalMod("shys", 1.5);
addGlobalMod("shyp", 1.5);
addGlobalMod("shya", 1.5);
addGlobalMod("scrollspeed", 0);
addGlobalMod("noterot", 2.5);
addGlobalMod("velocity", 2);
addGlobalMod("spinradius", 2);
addGlobalMod("spiny", 2);
addGlobalMod("spinx", 2);
addGlobalMod("driven", 4);
addGlobalMod("beat", 1.5);
addGlobalMod("wave", 2.5);
addGlobalMod("hom", 2);
addGlobalMod("boost_distance", 2.5);
addGlobalMod("boost_time", 2.5);
addGlobalMod("yoffset", 1.5);
addGlobalMod("notealp", 1.5);
addGlobalMod("przmc", 1);
addGlobalMod("prxd", 1);
addGlobalMod("pryd", 1);
addGlobalMod("prct", 1);
addGlobalMod("prcb", 1);
addGlobalMod("prcl", 1);
addGlobalMod("prcr", 1);
addGlobalMod("prvib", 1);
addGlobalMod("shct", 1);
addGlobalMod("shft", 1);
addGlobalMod("shcb", 1);
addGlobalMod("shfb", 1);
addGlobalMod("shcl", 1);
addGlobalMod("shfl", 1);
addGlobalMod("shcr", 1);
addGlobalMod("shfr", 1);
addGlobalMod("scrollind0", 1.5);
addGlobalMod("scrollind1", 1.5);
addGlobalMod("scrollind2", 1.5);
addGlobalMod("scrollind3", 1.5);
addGlobalMod("scrollind4", 1.5);
addGlobalMod("scrollind5", 1.5);
addGlobalMod("scrollind6", 1.5);
addGlobalMod("drawdist", 0);
addGlobalMod("pburstleft", 0.5);
addGlobalMod("pburstright", 0.5);
addGlobalMod("particlexpower", 0.5);
addGlobalMod("particleypower", 0.5);
addGlobalMod("uialpha", 0);
addGlobalMod("fx_contrast", 0.5);
addGlobalMod("fx_chroma_distort", 0.5);
addGlobalMod("fx_film", 1);
addGlobalMod("fx_glow", 1);
addGlobalMod("fx_particleglow", 0.5);
addGlobalMod("pburstspeed", 0.5);
addGlobalMod("freeze", 2);
addGlobalMod("drawuntil", 0);

// the horrors
addGimmick("obj___gimmick", [
    ["glitchamp"],["glitchoffset"],["fish"],["vig"],["bloom"],["gray"],
    ["posx"],["posy"],["cover1"],["cover2"],["cover3"],
    ["twx1"],["twy1"],["twa1"],["twr1"],
    ["twx2"],["twy2"],["twa2"],["twr2"],
    ["twx3"],["twy3"],["twa3"],["twr3"],
    ["twx4"],["twy4"],["twa4"],["twr4"],
    ["sina"],["sinp"],["sino"],
    ["cosa"],["cosp"],["coso"],
    ["tana"],["tanp"],["tano"],
    ["static"],["uialpha"],["spinradiusx"],["spinradiusz"],
    ["fakezy"],["fakezyb"],["float"],["wiggly"]
])
addGimmick("obj_00_gimmick", [["blipzoom"],["blipalpha"],["satal"],["satx"],["saty"]]);
addGimmick("obj_aleph_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],
    ["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],
    ["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"],["yoffset"]
])
addGimmick("obj_angelstar_gimmick", [
    ["uialpha"],["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],
    ["video"],["noteoverlayalp"],["shadermode"],["scorealph"],["bgalph"],["gray"],
    ["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],
    ["glitchamp"],["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],
    ["fx_hue_hue"],["fx_hue_saturation"],["fx_edge"],["fx_posterize"],["fx_twirl"],["fx_posterize_vis"],["fx_underwater"],
    ["bloom"],["angelstar_checker_alpha"],["angelstar_checker_set"],["fx_zoom"],["fx_red"],["recolor"],["holdoverlayalpha"]
])
addGimmick("obj_astellion_gimmick", [
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],
    ["uialpha"],["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],
    ["video"],["noteoverlayalp"],["astbars"],["bgalph"],["fxdist1"],["fxdist2"],["parttimer"]
])
addGimmick("obj_convergence_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],
    ["supernova_dialogue"],["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],
    ["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],["supernova_cg_frame"],
    ["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg2_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"],["setup_co"]
])
addGimmick("obj_credits_gimmick", [["lyricIndex"]]);
addGimmick("obj_distortedfate_gimmick", [
    ["df_sideline"],["df_whitebg"],["df_grid_alpha"],["df_grid_top"],["df_grid_bottom"],
    ["df_sideline2"],["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],
    ["abx"],["aby"],["aberamp"],["uialpha"],["cover1"],["cover2"],["cover3"],["wflash"],
    ["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"],["df_countdown"],
    ["lr_slash"],["lr_slash_color"],["lr_sides_blue"],["lr_sides_red"],
    ["lr_sides_rev_blue"],["lr_sides_rev_red"],["lr_mountain_bg"]
])
addGimmick("obj_dracula_gimmick", [["cover1"],["cover2"],["cover3"],["uialpha"],["vib"],["jart"],["jdesat"],["seedspeed"],["wflash"],["posx"],["posy"]])
addGimmick("obj_extendnova_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["supernova_dialogue"],
    ["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],
    ["fish"],["static"],["supernova_cg_frame"],["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],
    ["sn_bg_animspd"],["setup_co"],["setup_co_en_s1"],["setup_co_en_s2"],["setup_co_en_s3"],["setup_co_en_s4"],
    ["setup_co_en_s5"],["setup_co_en_s6"],["setup_co_en_s7"],["setup_co_en_s8"],["en_whiteoverlay"],
    ["en_voidparticles"],["en_slash_sat"],["en_posterize_vis"],["en_posterize"],["en_chorus_bg_alpha"],
    ["en_evildawn_hpbar_amount"],["en_gun_dawn"],["en_evildawn_hpbar_alpha"],["en_evildawn_hpbar_shake"],
    ["en_enddrop_bg_alpha"],["fx_edge"]
])
addGimmick("obj_firstbreath_gimmick", [
    ["df_sideline"],["df_whitebg"],["df_grid_alpha"],["df_grid_top"],["df_grid_bottom"],["df_sideline2"],
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["uialpha"],
    ["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],["video"],
    ["noteoverlayalp"],["df_countdown"],["lr_slash"],["lr_slash_color"],["lr_sides_blue"],["lr_sides_red"],
    ["lr_sides_rev_blue"],["lr_sides_rev_red"],["lr_mountain_bg"],["setup_co"],["glitchamp"],
    ["supernova_cg_alpha"],["supernova_cg_xscale"],["supernova_cg_frame"],["glitchoffset"],["uhnoise"],
    ["abberationxamp"],["abberationyamp"],["sn_bg_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"]
])
addGimmick("obj_lastwish_gimmick", [["uialpha"],["bgalph"],["film"],["glow"],["filmsat"],["lwcover"],["lwflickerspd"],["lwjitterintensity"],["lwchroma"],["lwtext"]])
addGimmick("obj_libertia_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["supernova_dialogue"],
    ["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],["uhnoise"],["abberationxamp"],
    ["abberationyamp"],["fish"],["static"],["supernova_cg_frame"],["sg_endblip_destroy"],["sn_bg_alpha"],
    ["sn_bg_fxamp"],["sn_bg_animspd"],["setup_co"]
])
addGimmick("obj_marenol_gimmick", [
    ["glitchamp"],["glitchoffset"],["fish"],["posx"],["posy"],["cover1"],["cover2"],["cover3"],
    ["twx1"],["twy1"],["twa1"],["twr1"],
    ["twx2"],["twy2"],["twa2"],["twr2"],
    ["twx3"],["twy3"],["twa3"],["twr3"],
    ["twx4"],["twy4"],["twa4"],["twr4"],
    ["sina"],["sinp"],["sino"],["cosa"],["cosp"],["coso"],["tana"],["tanp"],["tano"],
    ["static"],["vibx"],["viby"],["uialpha"],["flicker"]
])
addGimmick("obj_memories_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["supernova_dialogue"],
    ["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],
    ["fish"],["static"],["supernova_cg_frame"],["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"],["setup_co"]
])
addGimmick("obj_multigrode_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["glitchoffset"],
    ["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],["sg_endblip_destroy"],["sn_bg_alpha"],
    ["sn_bg_fxamp"],["sn_bg_animspd"],["yoffset"],["dialogue_size"],["text_alpha"],["dialogue_id"],["fruitmemoryx"],["refreshdialogue"]
])
addGimmick("obj_pictured_gimmick", [
    ["c_flash"],["c_shader"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["holdoverlayalpha"],["1_pinkbg_vis"],
    ["1_speech"],["1_glitch"],["2_boost"],["2_dialbox_size"],["2_dialbox_circles"],["2_bg_pics"],["2_dialbox_pulsar"],
    ["2_dialbox_speech"],["2_bg_pinkbg_vis"],["3_pinkbg_alph"],["3_noteblack"],["4_plusbg_vis"],["4_plusbg_pulse"],
    ["4_square_alph"],["4_square_rotspd"],["4_square_scale"],["5_video_toggle"],["5_video_alph"],["5_bord_alph"],
    ["5_abber"],["6_glitch"],["6_video_toggle"],["6_video_alph"],["6_red_layer_alph"],["6_static_alph"],
    ["7_bg_vis"],["7_note_vfx"],["7_static_alph"]
])
addGimmick("obj_plaudite_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["supernova_dialogue"],
    ["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],
    ["fish"],["static"],["supernova_cg_frame"],["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],
    ["sn_bg_animspd"],["setup_co"],["setup_co_sect4"],["setup_co_sect6"],["setup_co_sect8"],["setup_co_sect12"],
    ["setup_co_sect14"],["setup_co_end"],["plaudite_jacket"],["plaudite_sect2bg"],["plaudite_sect5bg"],
    ["plaudite_sect7bg"],["unraveling_sidething"],["astellion_sidething"],["astellion_particles"],["supernova_bg_visible"],
    ["libertia_bg_visible"],["stopmotion_bg_visible"],["convergence_bg_visible"],["plaudite_finaldropbg"],
    ["plaudite_finaldropwhitebg"],["plaudite_slash_saturday"],["plaudite_slash_dawn"],["plaudite_ending_event"],
    ["plaudite_red_particle"],["plaudite_pburst"],["plaudite_disable_jacket"],["plaudite_slash_neutral"],
    ["plaudite_finaldropbg2"],["holdoverlayalpha"],["setup_co_sect1"],["hide_combo"]
])
addGimmick("obj_ram_gimmick", [
    ["glitchamp"],["glitchoffset"],["fish"],["vig"],["bloom"],["gray"],
    ["posx"],["posy"],["cover1"],["cover2"],["cover3"],
    ["twx1"],["twy1"],["twa1"],["twr1"],
    ["twx2"],["twy2"],["twa2"],["twr2"],
    ["twx3"],["twy3"],["twa3"],["twr3"],
    ["twx4"],["twy4"],["twa4"],["twr4"],
    ["sina"],["sinp"],["sino"],["cosa"],["cosp"],["coso"],["tana"],["tanp"],["tano"],
    ["static"],["uialpha"],["spinradiusx"],["spinradiusz"],["fakezy"],["fakezyb"],["float"],["wiggly"],
    ["imgx1"],["imgy1"],["imgzm1"],["imgzmb1"],["imgzmx1"],["imgzmy1"],["imgrz1"],["imga1"],
    ["imgx2"],["imgy2"],["imgzm2"],["imgzmb2"],["imgzmx2"],["imgzmy2"],["imgrz2"],["imga2"],
    ["imgx3"],["imgy3"],["imgzm3"],["imgzmb3"],["imgzmx3"],["imgzmy3"],["imgrz3"],["imga3"],
    ["imgx4"],["imgy4"],["imgzm4"],["imgzmb4"],["imgzmx4"],["imgzmy4"],["imgrz4"],["imga4"],
    ["imgx5"],["imgy5"],["imgzm5"],["imgzmb5"],["imgzmx5"],["imgzmy5"],["imgrz5"],["imga5"],
    ["imgx6"],["imgy6"],["imgzm6"],["imgzmb6"],["imgzmx6"],["imgzmy6"],["imgrz6"],["imga6"],
    ["imgx7"],["imgy7"],["imgzm7"],["imgzmb7"],["imgzmx7"],["imgzmy7"],["imgrz7"],["imga7"],
    ["planea"],["rotdir"],["texta"]
])
addGimmick("obj_scarletdeath_gimmick", [
    ["uialpha"],["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"],["shadermode"],
    ["scorealph"],["bgalph"],["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["glitchamp"],
    ["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],["fx_hue_hue"],["fx_hue_saturation"],["fx_edge"],
    ["fx_posterize"],["fx_twirl"],["fx_posterize_vis"],["fx_underwater"],["bloom"],["angelstar_checker_alpha"],["angelstar_checker_set"],
    ["fx_zoom"],["fx_red"],["heartattack1"],["heartattack2"],["heartattack3"],["heartattack4"],["heartattack5"],["heartattack6"]
])
addGimmick("obj_sekaisen_gimmick", [
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["uialpha"],
    ["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"],
    ["starspawner_timer"],["starspd_low"],["starspd_high"],["starspd_multiplier"],["sekaisen_jacket"],["sekaisen_arrow_point"],
    ["sekaisen_target_point"],["track_alpha"],["en_whiteoverlay"],["eo_endsat1"],["eo_endsat2"],["eo_endsat3"],["eo_endsat4"],
    ["eo_endcg"],["bgalph"],["hide_combo"]
])
addGimmick("obj_self_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["holdoverlayalpha"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["glitchoffset"],
    ["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],["sg_endblip_destroy"],["sn_bg_alpha"],
    ["sn_bg_fxamp"],["sn_bg_animspd"],["yoffset"],["scrollind0"],["scrollind1"],["scrollind2"],["scrollind3"],
    ["scrollind4"],["scrollind5"],["scrollind6"],["stopmotionnoteskin"],["storycheck1"],["storycheck2"],["sm_bg_enable"],
    ["sm_bg_fade_alpha"],["temporaryshadercreate"],["temporaryshaderdestroy"],["sm_leftbg_frameset"],["sm_rightbg_frameset"],
    ["sm_pushcommand"],["sm_killcommand"],["sm_bar_show"],["sm_bar_progress"],["sm_cyclecount"],["self_satcolor"],
    ["self_satalpha"],["self_satframe"],["self_tsukicolor"],["self_tsukialpha"],["self_tsukiframe"],["self_destsg"],["self_gravebg"],["self_gravefg"]
])
addGimmick("obj_starcrashers_gimmick", [
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["uialpha"],
    ["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"],
    ["stargaze_mask_sat_alpha"],["stargaze_mask_tsuki_alpha"],["stargaze_mask_star_alpha"],["starspawner_timer"],
    ["starspd_low"],["starspd_high"],["starspd_multiplier"],["spawn_star_mask"],["intro_gradient_alpha"],
    ["missinglink_bg_alpha"],["turningpoint_bg_alpha"],["frostedmemories_bg_alpha"],["red_bg_alpha"],["black_bg_alpha"],
    ["laser_spawn"],["spawn_centerrect_red"],["spawn_centerrect_black"],["lasthours_checker_alpha"],
    ["lasthours_checker_chance"],["lasthours_checker_set"],["terminaljourney_bg_alpha"],["star_set_random_alpha"],
    ["buildup_cutin_alpha"],["buildup_cutin_frame"],["chorus_town_alpha"],["chorus_backgroundchecker_alpha"],["chorus_firework"],
    ["chorus_satalli_alpha"],["chorus_greenleft_overlay"],["chorus_satalli_bg_alpha"],["chorus_satalli_alli_particles"],
    ["chorus_satalli_sat_particles"],["end_libertia_bg_alpha"],["whitefade_alpha"],["end_gravescene1_alpha"],["blackfade_alpha"],
    ["end_gravescene2_alpha"],["ending_coroutine"]
])
addGimmick("obj_stargazers_gimmick", [
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["uialpha"],
    ["cover1"],["cover2"],["cover3"],["wflash"],["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"],
    ["bgalph"],["holdoverlayalpha"],["scorealph"],["sg_lanelines0"],["sg_lanelines1"],["sg_lanelines2"],
    ["sg_judgeline"],["sg_starspawner"],["starspd_low"],["starspd_high"],["star_pause"],["starspawn"],
    ["sg_endblip"],["sg_bg_alpha"],["sg_bg_speed"]
])
addGimmick("obj_stopmotion_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["holdoverlayalpha"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["glitchoffset"],
    ["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],
    ["sn_bg_animspd"],["yoffset"],["scrollind0"],["scrollind1"],["scrollind2"],["scrollind3"],["scrollind4"],["scrollind5"],
    ["scrollind6"],["stopmotionnoteskin"],["storycheck1"],["storycheck2"],["sm_bg_enable"],["sm_bg_fade_alpha"],["temporaryshadercreate"],
    ["temporaryshaderdestroy"],["sm_leftbg_frameset"],["sm_rightbg_frameset"],["sm_pushcommand"],["sm_killcommand"],["sm_bar_show"],
    ["sm_bar_progress"],["sm_cyclecount"]
])
addGimmick("obj_supernova_gimmick", [
    ["glitchamp"],["uialpha"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],["supernova_dialogue"],
    ["supernova_cg_xscale"],["supernova_cg_alpha"],["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],
    ["fish"],["static"],["supernova_cg_frame"],["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"],["setup_co"]
])
addGimmick("obj_times_gimmick", [
    ["glitchamp"],["static"],["wflash"],["tx"],["tx2"],["tx3"],["txj"],["ty"],["ty2"],["ty3"],["tyj"],["trz"],["trz2"],
    ["tz"],["tzx"],["tzy"],["tspl"],["sepx"],["sepy"],["spinang"],["spinrad"],["siny"],["vib"],["hid1"],["hid2"],["hid3"],["hid4"],["hid5"]
])
addGimmick("obj_tutorial_gimmick", [
    ["glitchamp"],["uialpha"],["cover1"],["scorealph"],["bgalph"],["noteoverlayalp"],["sg_endblip"],
    ["glitchoffset"],["uhnoise"],["abberationxamp"],["abberationyamp"],["fish"],["static"],
    ["sg_endblip_destroy"],["sn_bg_alpha"],["sn_bg_fxamp"],["sn_bg_animspd"],["yoffset"],["tutorialX"],["tutorialA"],["tutorialIndex"]
])
addGimmick("obj_unraveling_gimmick", [
    ["gray"],["barrel"],["barrel2"],["hdistort"],["fish"],["vig"],["abx"],["aby"],["aberamp"],["uialpha"],["cover1"],["cover2"],["cover3"],
    ["wflash"],["rainbow"],["sides"],["notealp"],["video"],["noteoverlayalp"]
])

function getModByteFromName(name, oname) {
    let mods = globalMods;

    if (name in mods) return mods[name];

    let obj = gimmicks[oname];

    if (obj) {
        return obj.extraMods[name];
    }

    console.error(`Unknown mod ${name}`);
    return globalMods.unknown;
}

function getModNameFromByte(b, name) {
    let mods = globalMods;

    if ((b & 128) == 128) {
        let obj = gimmicks[name];
        if (obj) {
            mods = obj.extraMods;
        }
    }

    let mod = Object.keys(mods)[Object.values(mods).indexOf(b)];
    if (mod) {
        console.log(`Found mod ${mod}`);
        return mod;
    }

    console.error(`Unknown mod ${b}`);
}

export {gimmicks, globalMods, modWeight, getModNameFromByte, getModByteFromName};