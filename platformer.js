(function () { // module pattern

    //-------------------------------------------------------------------------
    // POLYFILLS
    //-------------------------------------------------------------------------

    if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
        window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.oRequestAnimationFrame ||
            window.msRequestAnimationFrame ||
            function (callback, element) {
                window.setTimeout(callback, 1000 / 60);
            }
    }

    //-------------------------------------------------------------------------
    // UTILITIES
    //-------------------------------------------------------------------------

    function timestamp() {
        return window.performance && window.performance.now ? window.performance.now() : new Date().getTime();
    }

    function bound(x, min, max) {
        return Math.max(min, Math.min(max, x));
    }

    function get(url, onsuccess) {
        var request = new XMLHttpRequest();
        request.onreadystatechange = function () {
            if ((request.readyState == 4) && (request.status == 200))
                onsuccess(request);
        }
        request.open("GET", url, true);
        request.send();
    }

    function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
        return !(((x1 + w1 - 1) < x2) ||
            ((x2 + w2 - 1) < x1) ||
            ((y1 + h1 - 1) < y2) ||
            ((y2 + h2 - 1) < y1))
    }

    //-------------------------------------------------------------------------
    // GAME CONSTANTS AND VARIABLES
    //-------------------------------------------------------------------------

    var MAP = { tw: 64, th: 48 },
        WIN = false,
        level = 1,
        TILE = 32,
        METER = TILE,
        GRAVITY = 9.8 * 6, // default (exagerated) gravity
        MAXDX = 15,      // default max horizontal speed (15 tiles per second)
        MAXDY = 60,      // default max vertical speed   (60 tiles per second)
        ACCEL = 1 / 4,     // default take 1/2 second to reach maxdx (horizontal acceleration)
        FRICTION = 1 / 6,     // default take 1/6 second to stop from maxdx (horizontal friction)
        IMPULSE = 25,    // default player jump impulse
        COLOR = { BLACK: '#000000', YELLOW: '#ECD078', BRICK: '#D95B43', PINK: '#C02942', PURPLE: '#542437', GREY: '#333', SLATE: '#53777A', GOLD: 'gold', GREEN: 'green', RED:'red', WHITE: 'white', BLUE: 'blue' },
        COLORS = [COLOR.YELLOW, COLOR.BRICK, COLOR.PINK, COLOR.PURPLE, COLOR.GREY],
        KEY = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, W: 87, A: 65, S: 83, D: 68 };

    var fps = 60,
        step = 1 / fps,
        canvas = document.getElementById('canvas'),
        ctx = canvas.getContext('2d'),
        width = canvas.width = MAP.tw * TILE,
        height = canvas.height = MAP.th * TILE,
        img = new Image(),
        
        player = {},
        monsters = [],
        treasure = [],
        cells = [],
        goal = {};

    img.src = './tiles.png';
    var t2p = function (t) { return t * TILE; },//tile to pixel
        p2t = function (p) { return Math.floor(p / TILE); },//pixel to tile
        ccell = function (x, y) { return tcell(p2t(x), p2t(y)); },//pixel to cell
        tcell = function (tx, ty) { return cells[tx + (ty * MAP.tw)]; };//tile to cell


    //-------------------------------------------------------------------------
    // UPDATE LOOP
    //-------------------------------------------------------------------------

    function onkey(ev, key, down) {
        switch (key) {
            case KEY.A: player.left = down; ev.preventDefault(); return false;
            case KEY.D: player.right = down; ev.preventDefault(); return false;
            case KEY.SPACE: player.jump = down; ev.preventDefault(); return false;
        }
    }

    function update(dt) {
        updatePlayer(dt);
        updateMonsters(dt);
        checkTreasure();
        checkGoal()
    }

    function updatePlayer(dt) {
        updateEntity(player, dt);
    }

    function updateMonsters(dt) {
        var n, max;
        for (n = 0, max = monsters.length; n < max; n++)
            updateMonster(monsters[n], dt);
    }

    function updateMonster(monster, dt) {
        if (!monster.dead) {
            updateEntity(monster, dt);
            if (overlap(player.x, player.y, TILE, TILE, monster.x, monster.y, TILE, TILE)) {
                if ((player.dy > 0) && (monster.y - player.y > TILE / 4)){
                    killMonster(monster);
                    player.dy = -IMPULSE*25;
                }
                else{
                    killPlayer(player);
                }
            }
        }
    }

    function checkTreasure() {
        var n, max, t;
        for (n = 0, max = treasure.length; n < max; n++) {
            t = treasure[n];
            if (!t.collected && overlap(player.x, player.y, TILE, TILE, t.x, t.y, TILE, TILE))
                collectTreasure(t);
        }
    }
    function checkGoal() {
        if (overlap(player.x, player.y, TILE, TILE, goal.x, goal.y, TILE, TILE))
            WIN = true;
    }

    function killMonster(monster) {
        player.killed++;
        monster.dead = true;
    }

    function killPlayer(player) {
        player.x = player.start.x;
        player.y = player.start.y;
        player.dx = player.dy = 0;
        startlvl();
    }

    function collectTreasure(t) {
        player.collected++;
        t.collected = true;
    }

    function updateEntity(entity, dt) {
        var wasleft = entity.dx < 0,
            wasright = entity.dx > 0,
            falling = entity.falling,
            friction = entity.friction * (falling ? 0.5 : 1),
            accel = entity.accel * (falling ? 0.5 : 1);

        entity.ddx = 0;
        entity.ddy = entity.gravity;

        var tx = p2t(entity.x),
            ty = p2t(entity.y),
            nx = entity.x % TILE,
            ny = entity.y % TILE,
            cell = tcell(tx, ty),
            cellright = tcell(tx + 1, ty),
            cellleft = tcell(tx - 1, ty),
            cellrightex = ccell(entity.x + 3 + TILE, entity.y),//ex means exact
            cellleftex = ccell(entity.x - 3, entity.y),
            celldown = tcell(tx, ty + 1),
            celldiag = tcell(tx + 1, ty + 1),
            slidingL = /* entity.left  && */ cellleftex,
            slidingR = /* entity.right && */ cellrightex;

        if (entity.left) {//move left
            entity.ddx = entity.ddx - accel;
            if (cellleftex && entity.dy > 0) {//sliding motion
                entity.dy = friction / 20;
            }
        } else if (wasleft) {
            entity.ddx = entity.ddx + friction;
        }

        if (entity.right) {//move right
            entity.ddx = entity.ddx + accel;
            if (cellrightex && entity.dy > 0) {//sliding motion
                entity.dy = friction / 20;
            }
        }
        else if (wasright) {
            entity.ddx = entity.ddx - friction;
        }



        if (entity.jump && !entity.jumping && !falling) {
            entity.dy = /* entity.ddy */ - entity.impulse; // an instant big force impulse
            entity.jumping = true;
            entity.justJumped = true;
        } else if (entity.jump && falling && cellrightex && !entity.wallJumpingR && entity.jumping && slidingR && !entity.justJumped) {//on right wall
            entity.dy = /*entity.ddy*/ - entity.impulse * 0.7;
            entity.ddx = /*entity.ddx*/ - entity.impulse * 700;
            entity.wallJumpingR = true;
            entity.jumping = true;
            entity.justJumped = true;
            console.log("wall jump right");
        } else if (entity.jump && falling && cellleftex  && !entity.wallJumpingL && entity.jumping && slidingL && !entity.justJumped) {//on left wall
            entity.dy = /*entity.ddy*/ - entity.impulse * 0.7;
            entity.ddx = /*entity.ddx +*/ entity.impulse * 700;
            entity.dx = /*entity.ddx +*/ entity.impulse;
            entity.wallJumpingL = true;
            entity.jumping = true;
            entity.justJumped = true;
            console.log("wall jump left");
        }

        if (!entity.jump) {
            entity.justJumped = false;
        }

        if(falling && !cellright && entity.jumping || !entity.jump){
            entity.wallJumpingR = false;
        }

        if(falling && !cellleft  && entity.jumping || !entity.jump){
            entity.wallJumpingL = false;
        }

        entity.x = entity.x + (dt * entity.dx);
        entity.y = entity.y + (dt * entity.dy);
        entity.dx = bound(entity.dx + (dt * entity.ddx), -entity.maxdx, entity.maxdx);
        entity.dy = bound(entity.dy + (dt * entity.ddy), -entity.maxdy, entity.maxdy);

        if ((wasleft && (entity.dx > 0) && (entity.dx < friction) && !entity.wallJumpingL) ||
            (wasright && (entity.dx < 0) &&(entity.dx > -friction)&& !entity.wallJumpingR)) {
            //console.log("this is active: " + entity.dx);
            entity.dx = 0; // clamp at zero to prevent friction from making us jiggle side to side
        }


        if (entity.dy > 0) {
            if ((celldown && !cell) ||
                (celldiag && !cellright && nx)) {
                entity.y = t2p(ty);
                entity.dy = 0;
                entity.falling = false;
                entity.jumping = false;
                entity.wallJumping = false;
                ny = 0;
            }
        }
        else if (entity.dy < 0) {
            if ((cell && !celldown) ||
                (cellright && !celldiag && nx)) {
                entity.y = t2p(ty + 1);
                entity.dy = 0;
                cell = celldown;
                cellright = celldiag;
                ny = 0;
            }
        }

        if (falling && (!cellleft && !cellright) && entity.wallJumping) {
            entity.wallJumping = false;
        }

        if (entity.dx > 0) {
            if ((cellright && !cell) ||
                (celldiag && !celldown && ny)) {
                entity.x = t2p(tx);
                entity.dx = 0;
            }
        }
        else if (entity.dx < 0) {
            if ((cell && !cellright) ||
                (celldown && !celldiag && ny)) {
                entity.x = t2p(tx + 1);
                entity.dx = 0;
            }
        }

        if (entity.monster) {
            if (entity.left && (cell || !celldown)) {
                entity.left = false;
                entity.right = true;
            }
            else if (entity.right && (cellright || !celldiag)) {
                entity.right = false;
                entity.left = true;
            }
        }

        entity.falling = !(celldown || (nx && celldiag));

    }

    //-------------------------------------------------------------------------
    // RENDERING
    //-------------------------------------------------------------------------

    function render(ctx, frame, dt) {
        ctx.clearRect(0, 0, width, height);
        renderMap(ctx);
        renderTreasure(ctx, frame);
        renderGoal(ctx, frame);
        renderPlayer(ctx, dt);
        renderMonsters(ctx, dt);
    }

    function renderMap(ctx) {
        var x, y, cell;
        for (y = 0; y < MAP.th; y++) {
            for (x = 0; x < MAP.tw; x++) {
                cell = tcell(x, y);
                if (cell) {
                    //ctx.fillStyle = COLORS[cell - 1];
                    //ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                    drawFrame(cell - 1, 0, x * TILE, y * TILE);
                }
            }
        }
    }
    
    function drawFrame(frameX, frameY, canvasX, canvasY) {
        ctx.drawImage(img,
                      frameX * TILE, frameY * TILE, TILE, TILE,
                      canvasX, canvasY, TILE, TILE);
    }

    function renderPlayer(ctx, dt) {
        ctx.fillStyle = COLOR.YELLOW;
        ctx.fillRect(player.x + (player.dx * dt), player.y + (player.dy * dt), TILE, TILE);

        var n, max;

        ctx.fillStyle = COLOR.GOLD;
        for (n = 0, max = player.collected; n < max; n++)
            ctx.fillRect(t2p(2 + n), t2p(2), TILE / 2, TILE / 2);

        ctx.fillStyle = COLOR.SLATE;
        for (n = 0, max = player.killed; n < max; n++)
            ctx.fillRect(t2p(2 + n), t2p(3), TILE / 2, TILE / 2);
    }

    function renderMonsters(ctx, dt) {
        ctx.fillStyle = COLOR.RED;
        var n, max, monster;
        for (n = 0, max = monsters.length; n < max; n++) {
            monster = monsters[n];
            if (!monster.dead)
                ctx.fillRect(monster.x + (monster.dx * dt), monster.y + (monster.dy * dt), TILE, TILE);
        }
    }

    function renderTreasure(ctx, frame) {
        ctx.fillStyle = COLOR.GOLD;
        ctx.globalAlpha = 0.25 + tweenTreasure(frame, 60);
        var n, max, t;
        for (n = 0, max = treasure.length; n < max; n++) {
            t = treasure[n];
            if (!t.collected)
                ctx.fillRect(t.x, t.y + TILE / 3, TILE, TILE * 2 / 3);
        }
        ctx.globalAlpha = 1;
    }

    function renderGoal(ctx, frame) {
        ctx.fillStyle = COLOR.GREEN;
        ctx.globalAlpha = 0.25 + tweenTreasure(frame, 240);
        ctx.fillRect(goal.x, goal.y, TILE, TILE);
        ctx.globalAlpha = 1;
    }

    function tweenTreasure(frame, duration) {
        var half = duration / 2
        pulse = frame % duration;
        return pulse < half ? (pulse / half) : 1 - (pulse - half) / half;
    }

    //-------------------------------------------------------------------------
    // LOAD THE MAP
    //-------------------------------------------------------------------------

    function setup(map) {
        var data = map.layers[0].data,
            objects = map.layers[1].objects,
            n, obj, entity;

        for (n = 0; n < objects.length; n++) {
            obj = objects[n];
            entity = setupEntity(obj);
            switch (entity.name) {
                case "player": player = entity; break;
                case "monster": monsters.push(entity); break;
                case "treasure": treasure.push(entity); break;
                case "goal": goal = entity; break;
            }
        }

        cells = data;
    }

    function rectifyClasses(arr) {
        var fixed = {};
        for(var i = 0; i<arr.length; i++) {
            //console.log("rectifyClasses: " + JSON.stringify(arr[i]));
            switch (arr[i].name) {
                case "none":
                    fixed.ItIsVeryLate = "and i wanna kms";
                    break;
                case "gravity":
                    fixed.gravity = arr[i].value;
                    break;
                case "maxdx":
                    fixed.maxdx = arr[i].value;
                    break;
                case "maxdy":
                    fixed.maxdy = arr[i].value;
                    break;
                case "impulse":
                    fixed.impulse = arr[i].value;
                    break;
                case "accel":
                    fixed.accel = arr[i].value;
                    break;
                case "friction":
                    fixed.friction = arr[i].value;
                    break;
                case "left":
                    fixed.left = arr[i].value;
                    break;
                case "right":
                    fixed.right = arr[i].value;
                    break;
                case "HP":
                    fixed.HP = arr[i].value;
                    break;
                case "time":
                    fixed.time = arr[i].value;
                    break;
                default:
                    console.log("Unknown class: " + arr[i].name);
                    break;
            }
        }
        return fixed;
    }

    function setupEntity(obj) {
        //console.log(obj);
        if(!obj.hasOwnProperty("properties")){
            obj.properties = [{name:"none", value:0}];
        }
        obj.properties = rectifyClasses(obj.properties);
        console.log("obj.properties: " + obj.properties);
        var entity = {};
        entity.x = obj.x;
        entity.y = obj.y;
        entity.dx = 0;
        entity.dy = 0;
        entity.name = obj.name;
        entity.gravity = METER * (obj.properties.gravity || GRAVITY);
        entity.maxdx = METER * (obj.properties.maxdx || MAXDX);
        entity.maxdy = METER * (obj.properties.maxdy || MAXDY);
        entity.impulse = METER * (obj.properties.impulse || IMPULSE);
        entity.accel = entity.maxdx / (obj.properties.accel || ACCEL);
        entity.friction = entity.maxdx / (obj.properties.friction || FRICTION);
        entity.monster = obj.name == "monster";
        entity.player = obj.name == "player";
        entity.treasure = obj.name == "treasure";
        entity.goal = obj.name == "goal";
        entity.clock = obj.name == "clock";
        entity.left = obj.properties.left;
        entity.right = obj.properties.right;
        entity.start = { x: obj.x, y: obj.y };
        entity.killed = entity.collected = 0;
        entity.justJumpedL = false;
        entity.justJumpedR = false;
        entity.HP = (obj.properties.HP || -1);
        return entity;
    }

    //-------------------------------------------------------------------------
    // THE GAME LOOP
    //-------------------------------------------------------------------------

    var counter = 0, dt = 0, now,
        last = timestamp(),
        fpsmeter = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });

    function frame() {
        //console.log("framerate: " + fpsmeter.fps + " fps");
        fpsmeter.tickStart();
        now = timestamp();
        dt = dt + Math.min(1, (now - last) / 1000);
        while (dt > step) {
            dt = dt - step;
            update(step);
        }
        if(WIN){
            console.log("WIN");
            level++;
            startlvl();
            return;
        }
        render(ctx, counter, dt);
        last = now;
        counter++;
        fpsmeter.tick();
        requestAnimationFrame(frame, canvas);
    }

    document.addEventListener('keydown', function (ev) { return onkey(ev, ev.keyCode, true); }, false);
    document.addEventListener('keyup', function (ev) { return onkey(ev, ev.keyCode, false); }, false);
    
    function startlvl(){
        get("level" + level + ".json", function (req) {
            player = {},
            monsters = [],
            treasure = [],
            cells = [],
            goal = {};
            setup(JSON.parse(req.responseText));
            WIN = false;
            frame();
        });
    }
/*
    get("level" + level + ".json", function (req) {
        player = {},
        monsters = [],
        treasure = [],
        cells = [],
        goal = {};
        setup(JSON.parse(req.responseText));
        WIN = false;
        frame();
    });*/
    startlvl()
})();

