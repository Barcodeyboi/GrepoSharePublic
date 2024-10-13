// ==UserScript==
// @name         GrepoShare NL118
// @version      5.0
// @description  Script waarmee informatie kan worden gedeeld met je alliantie
// @author       Deodler
// @include      https://nl118.grepolis.com/game/*
// @include      *.grepolis.com/game/*
// @grant        none
// @run-at
// @noframes
// ==/UserScript==

const _key = localStorage.getItem("key")

const server = "https://api.greposhare.nl/"//"http://localhost:5000/"

$(document).ajaxComplete((e, xhr, opt) => {
    const [baseUrl, queryParams] = opt.url.split('?');
    if (queryParams) {
        const action = `${baseUrl.slice(5)}/${queryParams.split(/&/)[1]?.slice(7)}`;
        if (action === '/town_overviews/command_overview') {
            bCreate();
        }
    }
});

function bCreate() {
    const button = document.createElement('div');
    button.innerHTML = `
        <a href="#" id="greposhare" class="button" style="float: right;">
            <span class="left">
                <span class="right">
                    <span id="greposhare_txt" class="middle">Sync +</span>
                </span>
            </span>
        </a>
    `;
    button.addEventListener('click', function () {
        const greposhareTxt = $('#greposhare_txt');
        if (greposhareTxt.length) {
            greposhareTxt.text('Synced').css('color', '#36cd5b');
        }
        button.removeEventListener('click', this);
        imp_commands();
        updateTroopViewer();
    });
    document.getElementById('game_list_footer').appendChild(button);
}

async function imp_commands() {
    await ITowns.townGroups.setActiveTownGroup(-1);
    await sleep(400);

    const movementCommands = await get_commands();
    const payload = {
        key: _key,
        worldID: Game.world_id,
        playerName: Game.player_name,
        playerId: Game.player_id,
        timestamp: Timestamp.now(),
        movementCommands
    };

    fetch(server+'api/unitmovements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

async function get_commands() {
    const response = await $.ajax({
        url: `https://${Game.world_id}.grepolis.com/game/town_overviews?town_id=${Game.townId}&action=command_overview&h=${Game.csrfToken}&json=%7B%22town_id%22%3A${Game.townId}%2C%22nl_init%22%3Atrue%7D&_=${Date.now()}`,
        contentType: 'application/json',
        type: 'GET',
    });
    return response.json.data.commands;
}

function popupUpdater() {
    const buttonHtml = `
        <a href="#" id="greposhare-updater" class="button">
            <span class="left">
                <span class="right">
                    <span class="middle">Sync +</span>
                </span>
            </span>
        </a>
    `;
    const wnd = Layout.wnd.Create(Layout.wnd.TYPE_DIALOG, 'GrepoShare');
    wnd.setContent(buttonHtml);
    wnd.setWidth(150);
    wnd.setHeight(100);

    $('#greposhare-updater').click(() => {
        imp_commands();
        updateTroopViewer();
        wnd.close();
    });
}

var troopviewerevents = {}

function setTroopListener() {
    console.log("Listener initialized");

    //Troop viewer listener
    $('#map_towns')
        .on('mouseenter', '.tile', function (event) {
            const target = event.currentTarget.id;

            if (target.includes('free') || target.includes('farm_town')) return;

            const id = target.replace(/^\D+/g, "");
            console.log("ID:", id);

            troopviewerevents[id] = setTimeout(() => {
                get_units_for_town(id).then((data) => {
                    if (!data) {
                        console.error("No data received for town ID:", id);
                        return;
                    }

                    const {
                        town_id,
                        town_name,
                        units,
                        buildings,
                        god,
                        hero,
                        last_update,
                        espionageStorage
                    } = data;

                    if (!units) {
                        console.log('No unit data available for:', town_name);
                        return;
                    }

                    const lastUpdateText = `<br>Last updated: ${new Date(last_update * 1000).toLocaleString()}`;
                    $('.town_tooltip h4')[0].innerHTML += lastUpdateText;

                    let popUpContent = `
                        <div class="units_tooltip_infos">
                            <span>Stadseenheden</span>
                            <span class="divider_line_units_tooltips"></span>
                        </div>`;

                    const defendingUnits = units.defending_units;
                    popUpContent += Object.keys(defendingUnits).map(unit =>
                        `<div class="greposhare unit_icon40x40 ${unit}">
                            <span class="place_unit_white count text_shadow">${defendingUnits[unit]}</span>
                        </div>`
                    ).join('');

                    if (hero) {
                        popUpContent += `
                            <div class="hero_icon hero40x40 ${hero.type}">
                                <span class="place_unit_white count text_shadow">${hero.level}</span>
                            </div>`;
                    }

                    popUpContent += `
                        <div class="units_tooltip_infos">
                            <span>Gebouwen</span>
                            <span class="divider_line_units_tooltips"></span>
                        </div>`;

                    const buildingIcons = ['wall', 'tower', 'hide'];
                    buildingIcons.forEach(building => {
                        popUpContent += `
                            <div class="greposhare ${building} building_icon40x40 image bold">
                                <span class="place_unit_white count text_shadow">${buildings[building]}</span>
                            </div>`;
                    });

                    popUpContent += `
                        <div class="units_tooltip_infos">
                            <span>Overige informatie</span>
                            <span class="divider_line_units_tooltips"></span>
                        </div>
                        Zilver: ${espionageStorage}`;

                    if (god) {
                        popUpContent += `<div class="god_mini ${god}"></div>`;
                    }

                    $('.town_infos').append(popUpContent);
                }).catch(err => {
                    console.error("Error fetching units for town ID:", id, err);
                });
            }, 400);
        })
        .on('mouseleave', '.tile', function (event) {
            const target = event.currentTarget.id;
            if (target.includes('free')) return;

            const id = target.replace(/^\D+/g, "");
            clearTimeout(troopviewerevents[id]);
        });
}


async function get_units_for_town(town_id) {
    const payload = {
        key: _key,
        townID: town_id,
        worldID: Game.world_id,
        playerName: Game.player_name,
        playerId: Game.player_id,
        timestamp: Timestamp.now()
    };

    const queryParams = new URLSearchParams(payload).toString();

    const response = await fetch(`${server}api/unitstown?${queryParams}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    return await response.json();
}

function getTroopViewerData() {
    const alltowns = ITowns.getTowns();
    const townlist = [];
    const heroModels = MM.getCollections().PlayerHero[0].models;

    const heroObj = heroModels.reduce((acc, heroModel) => {
        const hero = heroModel.attributes;
        acc[hero.home_town_id] = { type: hero.type, level: hero.level };
        return acc;
    }, {});

    const mergeTroops = (data) => {
        return data.reduce((result, town) => {
            Object.entries(town).forEach(([key, value]) => {
                result[key] = (result[key] || 0) + value;
            });
            return result;
        }, {});
    };

    for (const key of Object.keys(alltowns)) {
        const town = alltowns[key];
        const units = {
            available_units: town.units(),
            support_units: town.unitsSupport(),
            outer_units: town.unitsOuter(),
            defending_units: mergeTroops([
                town.units(),
                town.unitsSupport(),
            ]),
        };

        const townData = {
            playerName: Game.player_name,
            town_id: town.getBuildings().attributes.id,
            town_name: town.name,
            buildings: { ...town.getBuildings().attributes },
            god: town.god(),
            units: units,
            last_update: Timestamp.now(),
            espionageStorage: town.getEspionageStorage(),
            hero: heroObj[town.getBuildings().attributes.id] || undefined,
        };

        townlist.push(townData);
    }

    return townlist;
}

function updateTroopViewer() {
    var result = getTroopViewerData()

    const payload = {
        key: _key,
        result: result,
        worldID: Game.world_id,
        playerName: Game.player_name,
        playerId: Game.player_id,
        timestamp: Timestamp.now()
    };

    fetch(server+'api/unitstown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

function voegCSSTroopCounterToe() {
    $('<style id="greposhare_town_popup_style" type="text/css">' +

                '.greposhare.title { margin:5px;font-weight: bold; margin-right: 15px;} ' +

                '.greposhare.unit_content, ' +
                '.greposhare.move_counter_content, ' +
                '.greposhare.spy_content, ' +
                '.greposhare.god_content, ' +
                '.greposhare.hero_content, ' +
                '.greposhare.resources_content { background-color: #ffe2a1; border: 1px solid #e1af55; margin-top:2px; padding: 4px; font-family: Arial;font-weight: 700;font-size: 0.8em; } ' +
                '.greposhare.resources_content { text-align: right; margin-top:3px; } ' +

                '.greposhare.resources_content table { min-width:95% } ' +

                '.greposhare.footer_content { margin-top:3px;  } ' +
                '.greposhare.footer_content table { width:100%; } ' +

                '.greposhare.spy_content { height:25px; margin-right:3px; } ' +
                '.greposhare.god_content { width:25px; } ' +
                '.greposhare.hero_content { width:25px; } ' +

                '.greposhare.god_mini { transform:scale(0.4); margin: -19px; } ' +

                '.greposhare.count { position: absolute; bottom: -2px; right: 2px; font-size: 10px; font-family: Verdana,Arial,Helvetica,sans-serif; } ' +
                '.greposhare.four_digit_number .count { font-size:8px !important; } ' +
                '.greposhare.unit_icon40x40 { border: 1px solid #6e4b0b; margin: 1px; } ' +
                '.greposhare.wall { width:40px; height:40px; background-image:url(https://gpde.innogamescdn.com/images/game/main/wall.png); border: 1px solid #6e4b0b; margin: 1px; background-size: 100%; } ' +
                '.greposhare.tower { width:40px; height:40px; background-image:url(https://gpde.innogamescdn.com/images/game/main/tower.png); border: 1px solid #6e4b0b; margin: 1px; background-size: 100%; } ' +
                '.greposhare.hide { width:40px; height:40px; background-image:url(https://gpde.innogamescdn.com/images/game/main/hide.png); border: 1px solid #6e4b0b; margin: 1px; background-size: 100%; } ' +
                '</style>').appendTo('head');
}

function setKeyListener() {
    $("#ui_box > div.nui_main_menu > div.middle > div.content > ul").prepend(
        `<li class="greposhare main_menu_item" id="greposhare-main-menu-button">
            <span class="content_wrapper">
                <span class="button_wrapper">
                    <span class="button">
                        <span class="icon" style="background: url(server+"assets/main-menu-icon") no-repeat;"></span>
                    </span>
                </span>
                <span class="name_wrapper">
                    <span class="name">GrepoShare Settings</span>
                </span>
            </span>
        </li>`
      );

      async function generateKey() {
        const payload = {
            worldID: Game.world_id,
            playerName: Game.player_name,
          };

        const queryParams = new URLSearchParams(payload).toString();
        const response = await fetch(`${server}api/getKey?${queryParams}`, {
            method: 'GET',
          });

        const result = await response.text();
        return result
      }

      $("#greposhare-main-menu-button").on("click", function () {
        const wnd = Layout.wnd.Create(Layout.wnd.TYPE_DIALOG, 'GrepoShare Settings');
        const key = localStorage.getItem("key") || "Generate a new key...";
        const html = `
            <a href="#" id="greposhare-generate-key" class="button">
                <span class="left">
                    <span class="right">
                        <span class="middle">Generate key</span>
                    </span>
                </span>
            </a>
            <div class="textbox" style="width: 250px;">
                <div class="left"></div>
                <div class="right"></div>
                <div class="middle">
                    <input id="greposhare-input-key" type="text" value="" tabindex="1" placeholder="${key}">
                </div>
                <div class="error-msg js-txt-error-msg"></div>
            </div>
            <a href="#" id="greposhare-save-key" class="button">
                <span class="left">
                    <span class="right">
                        <span class="middle">Save key</span>
                    </span>
                </span>
            </a>
        `;
        wnd.setContent(html);
        wnd.setWidth(500);
        wnd.setHeight(90);

        $("#greposhare-generate-key").click(async function(){
            $('#greposhare-input-key')[0].value = await generateKey();
        });
        $("#greposhare-save-key").click(async function(){
            const key = $('#greposhare-input-key')[0].value
            const payload = {
                key,
                playerName: Game.player_name,
            };

            fetch(server + 'api/getKey', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(response => {
                if (response.status === 200) {
                    console.log("Successfully saved a key!");
                    localStorage.setItem("key", key);
                    window.location.reload();
                } else {
                    console.log("Failed to save the key...");
                }
            })
            .catch(error => {
                console.error("Error:", error);
            });
        });
      });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function WaitForDocumentReady() {
    await sleep(5000);
    popupUpdater();
    setTroopListener()
    setKeyListener()
}

WaitForDocumentReady();