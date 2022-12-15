
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
        request.open("GET", url, true);request.open("GET", url, true);
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
        level = 0,
        levelplus = false,
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
        KEY = { SPACE: 32, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, W: 87, A: 65, S: 83, D: 68, BackSlash: 220 };

    var fps = 60,
        step = 1 / fps,
        canvas = document.getElementById('canvas'),
        ctx = canvas.getContext('2d'),
        width = canvas.width = MAP.tw * TILE,
        height = canvas.height = MAP.th * TILE,
        img = new Image(),
        
        player = {},
        monsters = [],
        boss = [],
        treasure = [],
        cells = [],
        goal = {},
        clock = {},
        ttext = [];

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
            case KEY.BackSlash: if(!levelplus && !down){levelplus = true; WIN=true} ev.preventDefault(); return false;
        }
    }

    function update(dt) {
        updateBoss(dt);
        updatePlayer(dt);
        updateMonsters(dt);
        checkTreasure();
        checkGoal()
        checkTime();
        if(!(boss==null)){//have to but it here or it will not work idk
            if (!boss.dead) {
                updateBoss(boss, dt);
                if (overlap(player.x, player.y, TILE, TILE, boss.x, boss.y, TILE*4, TILE*4)) {
                    if(!boss.stepped){
                        console.log("overlapping");
                        if ((player.dy > 0) && (boss.y - player.y > TILE / 4)){
                            if(boss.HP > 0){
                                boss.HP--;
                                boss.stepped == true;
                            }else{
                                killMonster(boss);
                                
                            }
                            player.dy = -IMPULSE*25;
                        }
                        else{
                            killPlayer(player);
                            clock.clockrunning = false;
                        }
                    }
                }else{
                    console.log("not overlapping");
                    boss.stepped = false;
                }
            }else{

            }
        }
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

/*     function updateBoss(dt) {
        console.log(JSON.stringify(boss) + " " + boss.dead );
        if (!boss.dead && !(boss==null)) {
            updateBoss(boss, dt);
            if (overlap(player.x, player.y, TILE, TILE, boss.x, boss.y, TILE*4, TILE*4) && boss.stepped == false) {
                if ((player.dy > 0) && (boss.y - player.y > TILE / 4)){
                    if(boss.hp > 0){
                        boss.hp--;
                        boss.stepped == true;
                    }else{
                        killMonster(boss);
                        boss.stepped == false;
                    }
                    player.dy = -IMPULSE*25;
                }
                else{
                    killPlayer(player);
                }
            }
        }
    } */

    function checkTime(){
        if(clock.time <= 0){
            killPlayer(player);
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
        if (overlap(player.x, player.y, TILE, TILE, goal.x, goal.y, TILE, TILE) && !goal.touching){
            WIN = true;goal.touching = true;
        }
        else{
            goal.touching = false;
        }
    }

    function killMonster(monster) {
        player.killed++;
        monster.dead = true;
    }

    function killPlayer(player) {
        player.x = player.start.x;
        player.y = player.start.y;
        player.dx = player.dy = 0;
        clock.audio.pause();
        startlvl();
    }

    function collectTreasure(t) {
        player.collected++;
        clock.time += 1;
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
            //console.log("wall jump right");
        } else if (entity.jump && falling && cellleftex  && !entity.wallJumpingL && entity.jumping && slidingL && !entity.justJumped) {//on left wall
            entity.dy = /*entity.ddy*/ - entity.impulse * 0.7;
            entity.ddx = /*entity.ddx +*/ entity.impulse * 700;
            entity.dx = /*entity.ddx +*/ entity.impulse;
            entity.wallJumpingL = true;
            entity.jumping = true;
            entity.justJumped = true;
            //console.log("wall jump left");
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

        if (entity.boss) {
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

    function updateBoss(entity, dt) {
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
            cellright = tcell(tx + 4, ty),
            cellleft = tcell(tx - 1, ty),
            cellrightex = ccell(entity.x + 3 + TILE, entity.y),//ex means exact
            cellleftex = ccell(entity.x - 3, entity.y),
            celldown = tcell(tx, ty + 1*4),
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
            //console.log("wall jump right");
        } else if (entity.jump && falling && cellleftex  && !entity.wallJumpingL && entity.jumping && slidingL && !entity.justJumped) {//on left wall
            entity.dy = /*entity.ddy*/ - entity.impulse * 0.7;
            entity.ddx = /*entity.ddx +*/ entity.impulse * 700;
            entity.dx = /*entity.ddx +*/ entity.impulse;
            entity.wallJumpingL = true;
            entity.jumping = true;
            entity.justJumped = true;
            //console.log("wall jump left");
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

        if (entity.boss) {
            if (entity.left && (cellleft)) {
                console.log("left");
                entity.left = false;
                entity.right = true;
            }
            else if (entity.right && (cellright)) {
                console.log("right");
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
        renderTreasure(ctx, frame);
        renderGoal(ctx, frame);
        renderPlayer(ctx, dt);
        renderMonsters(ctx, dt);
        renderBoss(ctx, dt);
        renderMap(ctx);
        renderClock(ctx, dt);
        renderText(ctx, dt);
        if(!(boss==null)){//have to but it here or it will not work idk
            if (boss.dead) {
                ctx.fillStyle = "white";
                ctx.font = "bold 120px Arial";
                ctx.fillText("You Win", 500, 500);
                clock.clockrunning = false;
            }   
        }
    }

    function renderMap(ctx) {
        var x, y, cell;
        for (y = 0; y < MAP.th; y++) {
            for (x = 0; x < MAP.tw; x++) {
                cell = tcell(x, y);
                if (cell) {
                    //ctx.fillStyle = COLORS[cell - 1];
                    //ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
                    drawFrame(ctx, cell - 1, 0, x * TILE, y * TILE);
                }
            }
        }
    }
    
    function drawFrame(ctx, frameX, frameY, canvasX, canvasY) {
        ctx.drawImage(img,
                      frameX * TILE, frameY * TILE, TILE, TILE,
                      canvasX, canvasY, TILE, TILE);
    }

    function renderPlayer(ctx, dt) {
        //ctx.fillStyle = COLOR.YELLOW;
        //console.log(player.dx);
        if (player.dx != 0) {
            player.frame += player.dx/(Math.PI*256);
        }
        player.frame = player.frame % 360;
        //console.log(player.frame);
        //ctx.fillRect(player.x + (player.dx * dt), player.y + (player.dy * dt), TILE, TILE);
        ctx.save(); // save current state
        ctx.translate(player.x + (player.dx * dt) + TILE / 2,player.y + (player.dy * dt)+ TILE / 2);
        ctx.rotate(player.frame); // rotate
        drawFrame(ctx, 0, 1, -TILE / 2, -TILE / 2);
        ctx.restore();
        /* 
        var n, max;

        ctx.fillStyle = COLOR.GOLD;
        for (n = 0, max = player.collected; n < max; n++)
            ctx.fillRect(t2p(2 + n), t2p(2), TILE / 2, TILE / 2);

        ctx.fillStyle = COLOR.SLATE;
        for (n = 0, max = player.killed; n < max; n++)
            ctx.fillRect(t2p(2 + n), t2p(3), TILE / 2, TILE / 2); */
    }

    function renderMonsters(ctx, dt) {
        ctx.fillStyle = COLOR.RED;
        var n, max, monster;
        for (n = 0, max = monsters.length; n < max; n++) {
            monster = monsters[n];
            if (!monster.dead){
                if (monster.dx != 0) {
                    monster.frame += monster.dx/(Math.PI*256);
                }
                monster.frame = monster.frame % 360;
                //ctx.fillRect(player.x + (player.dx * dt), player.y + (player.dy * dt), TILE, TILE);
                ctx.save(); // save current state
                ctx.translate(monster.x + (monster.dx * dt) + TILE / 2,monster.y + (monster.dy * dt)+ TILE / 2);
                ctx.rotate(monster.frame); // rotate
                drawFrame(ctx, 0, 3, -TILE / 2, -TILE / 2);
                ctx.restore();
            }
        }
    }

    function renderBoss(ctx, dt) {
        if(!(boss == null)){
            if (!boss.dead){
                if (boss.dx != 0) {
                    boss.frame += boss.dx/(Math.PI*256);
                }
                boss.frame = boss.frame % 360;
                //ctx.fillRect(player.x + (player.dx * dt), player.y + (player.dy * dt), TILE, TILE);
                ctx.save(); // save current state
                ctx.translate(boss.x + (boss.dx * dt) + TILE*2,boss.y + (boss.dy * dt)+ TILE*2);
                ctx.rotate(boss.frame); // rotate
                //drawFrame(ctx, 0, 3, -TILE / 2, -TILE / 2);
                ctx.drawImage(img,
                    64, 96, 64, 64,
                    -TILE*2, -TILE*2, TILE*4, TILE*4,);
                ctx.restore();
            }
        }
    }

    function renderClock(ctx, dt) {
        ctx.fillStyle = "#928E8E";
        ctx.font = '90px Arial LightGray';
        if(clock.clockrunning){
        var timee = new Date().valueOf();
        clock.time += (clock.timel - timee)/1000;
        clock.timel = timee
        }
        var ctext = clock.time;
        ctext = ctext.toFixed(2);
        ctx.fillText(ctext, clock.x, clock.y + 90);
        if(!clock.playing && player.x != player.start.x){
            clock.audio = new Audio(clock.music);
            clock.audio.volume = 0.2;
            clock.audio.loop = true;
            clock.audio.play(); 
            clock.playing = true;
        }
    }

    function renderText(ctx, dt) {
        
        var n, max, t;
        for (n = 0, max = ttext.length; n < max; n++) {
            t = ttext[n];
            ctx.fillStyle = t.color;
            ctx.font = t.font;
            ctx.fillText(t.textcon, t.x, t.y + 90);
        }
    }

    function renderTreasure(ctx, frame) {
        ctx.fillStyle = COLOR.GOLD;
        ctx.globalAlpha = 0.25 + tweenTreasure(frame, 60);
        var n, max, t;
        for (n = 0, max = treasure.length; n < max; n++) {
            t = treasure[n];
            if (!t.collected)
            drawFrame(ctx, (frame % (60 / 2))? 1 : 0, 7, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }

    function renderGoal(ctx, frame) {
        ctx.fillStyle = COLOR.GREEN;
        ctx.globalAlpha = 0.25 + tweenTreasure(frame, 240*2);
        drawFrame(ctx, (frame % (60 / 2))? 1 : 0, 5, goal.x, goal.y);
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
                case "boss": boss = entity; break;
                case "treasure": treasure.push(entity); break;
                case "goal": goal = entity; break;
                case "clock": clock = entity; break;
                case "textBox": ttext.push(entity); break;
            }
        }

        cells = data;
    }

    function rectifyClasses(arr) {
        var fixed = {};
        for(var i = 0; i<arr.length; i++) {
            //eval("fixed." + arr[i].name) = arr[i].value;            
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
                case "textco":
                    //console.log("text: " + arr[i].value);
                    fixed.textco = arr[i].value;
                    break;
                case "font":
                    fixed.font = arr[i].value;
                    break;
                case "color":
                    fixed.color = arr[i].value;
                    break;
                case "music":
                    fixed.music = arr[i].value;
                    break;
                default:
                    console.log("Unknown class: " + arr[i].name.toString());
                    break;
                //eval("fixed." + arr[i].name + " = " + arr[i].value);
            }

        }
        //console.log("fixed: " + JSON.stringify(fixed) + " " + fixed.textco);
        return fixed;
    }

    function setupEntity(obj) {
        //console.log(obj);
        if(!obj.hasOwnProperty("properties")){
            obj.properties = [{name:"none", value:0}];
        }
        //console.log("setup: " + JSON.stringify(obj));
        for(var property in obj.properties) {
            //console.log("setup: " + property.name + " " + property.value);
        }
        obj.properties = rectifyClasses(obj.properties);
        
        //console.log("obj.properties: " + obj.properties);
        /* for(var property in obj) {
            console.log(property + "=" + obj[property]);
        }
        for(var property in obj.properties) {
            console.log(property + "=" + obj[property]);
        } */
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
        entity.text = obj.name == "text";
        entity.boss = obj.name == "boss";
        entity.left = obj.properties.left;
        entity.right = obj.properties.right;
        entity.start = { x: obj.x, y: obj.y };
        entity.killed = entity.collected = 0;
        entity.justJumpedL = false;
        entity.justJumpedR = false;
        entity.HP = (obj.properties.HP || -1);
        entity.frame = 0;//it is realing rotation but i dont want to change it
        entity.time = (obj.properties.time || -1);
        entity.timel = new Date().valueOf();
        entity.textcon = (obj.properties.textco || "");
        entity.font = (obj.properties.font || "");
        entity.color = (obj.properties.color || COLOR.BLACK);
        entity.stepped = false;
        entity.music = (obj.properties.music || "");
        entity.clockrunning = true;
        entity.playing = false;
        entity.audio;
        entity.touching = false;
        //console.log("entity.font: " + entity.font);
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
            //console.log("WIN");
            clock.audio.pause();
            startlvl(false);
            //return;
        }
        render(ctx, counter, dt);
        last = now;
        counter++;
        fpsmeter.tick();
        
        requestAnimationFrame(frame, canvas);
    }

    document.addEventListener('keydown', function (ev) { return onkey(ev, ev.keyCode, true); }, false);
    document.addEventListener('keyup', function (ev) { return onkey(ev, ev.keyCode, false); }, false);
    
    function startlvl(first){
        console.log("level: " + level);
        get("level" + level + ".json", function (req) {
            console.log("2level: " + level);
            level++;
            fpsmeter = new FPSMeter({ decimals: 0, graph: true, theme: 'dark', left: '5px' });
            player = {},
            monsters = [],
            treasure = [],
            cells = [],
            goal = {};
            clock = {};
            ttext = [];
            levelplus = false;
            boss = null;
            setup(JSON.parse(req.responseText));
            WIN = false;
            if(first){
                frame();
            }
        });
    }

    startlvl(true)
})();

