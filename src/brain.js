
var GS = require("../getsource.js");

var ROT = GS.getSource("ROT", "./lib/rot.js");
var RG = GS.getSource("RG", "./src/rg.js");

//---------------------------------------------------------------------------
// BRAINS {{{1
//---------------------------------------------------------------------------

RG.Brain = {};

/** This brain is used by the player actor. It simply handles the player input
 * but by having brain, player actor looks like other actors.  */
RG.Brain.Player = function(actor) { // {{{2

    var _actor = actor;

    var _guiCallbacks = {}; // For attaching GUI callbacks

    /** For given code, adds a GUI callback. When this keycode is given, a GUI
     * callback is called instead. */
    this.addGUICallback = function(code, callback) {
        _guiCallbacks[code] = callback;
    };

    this.energy = 1; // Consumed energy per action

    var _energyPerAction = {
        REST: 1,
        PICKUP: 1,
        MOVE: 2,
        ATTACK: 3,
        RUN: 4,
    };

    var _confirmCallback = null;
    var _wantConfirm = false;
    var _confirmEnergy = 1;

    var _runModeEnabled = false;
    var _baseSpeed = _actor.get("Stats").getSpeed();

    /** Restores the base speed after run-mode.*/
    var _restoreBaseSpeed = function() {
        _runModeEnabled = false;
        this.energy = 1;
        _actor.get("Stats").setSpeed(_baseSpeed);
    };

    this.isRunModeEnabled = function() {return _runModeEnabled;};

    this.decideNextAction = function(obj) {
        this.energy = 1;

        // Workaround at the moment, because missile attacks are GUI-driven
        if (obj.hasOwnProperty("cmd")) {
            _restoreBaseSpeed();
            if (obj.cmd === "missile") this.energy = 2;
            return function() {};
        }

        var code = obj.code;
        if (_wantConfirm && _confirmCallback !== null) {
            // Want y/n answer
            _wantConfirm = false;
            if (code === ROT.VK_Y) {
                this.energy = _confirmEnergy;
                return _confirmCallback;
            }
        }

        // Invoke GUI callback with given code
        if (_guiCallbacks.hasOwnProperty(code)) {
            _guiCallbacks[code](code);
            return null;
        }

        if (code === ROT.VK_R) {
            if (_runModeEnabled) {
                _restoreBaseSpeed();
                return null;
            }
            else {
                _runModeEnabled = true;
                this.energy = 4;
                _baseSpeed = _actor.get("Stats").getSpeed();
                var newSpeed = Math.floor( 1.5 * _baseSpeed);
                _actor.get("Stats").setSpeed(newSpeed);
                return null;
            }
        }

        // Need existing position
        var level = _actor.getLevel();
        var x = _actor.getX();
        var y = _actor.getY();
        var xOld = x;
        var yOld = y;
        var currMap = level.getMap();
        var currCell = currMap.getCell(x, y);

        var type = "NULL";
        if (code === ROT.VK_D) { ++x; type = "MOVE";}
        if (code === ROT.VK_A) { --x; type = "MOVE";}
        if (code === ROT.VK_W) { --y; type = "MOVE";}
        if (code === ROT.VK_X) { ++y; type = "MOVE";}
        if (code === ROT.VK_Q) {--y; --x; type = "MOVE";}
        if (code === ROT.VK_E) {--y; ++x; type = "MOVE";}
        if (code === ROT.VK_C) {++y; ++x; type = "MOVE";}
        if (code === ROT.VK_Z) {++y; --x; type = "MOVE";}
        if (code === ROT.VK_S) {type = "REST";}
        if (type !== "MOVE") _restoreBaseSpeed();

        if (code === ROT.VK_PERIOD) {
            type = "PICKUP";
            if (currCell.hasProp("items")) {
                return function() {
                    level.pickupItem(_actor, x, y);
                };
            }
            else {
                this.energy = 0;
                RG.gameWarn("There are no items to pick up.");
                return null;
            }
        }

        if (code === ROT.VK_COMMA) {
            type = "STAIRS";
            if (currCell.hasStairs()) {
                return function() {level.useStairs(_actor);};
            }
            else {
                this.energy = 0;
                RG.gameWarn("There are no stairs here.");
                return null;
            }
        }

        if (type === "MOVE") {
            if (currMap.hasXY(x, y)) {
                if (currMap.isPassable(x, y)) {
                    this.energy = _energyPerAction.MOVE;
                    return function() {
                        var movComp = new RG.Component.Movement(x, y, level);
                        _actor.add("Movement", movComp);
                    };
                }
                else if (currMap.getCell(x,y).hasProp("actors")) {
                    _restoreBaseSpeed();
                    var target = currMap.getCell(x, y).getProp("actors")[0];
                    var callback = function() {
                        var attackComp = new RG.Component.Attack(target);
                        _actor.add("Attack", attackComp);
                    };

                    if (target.isEnemy(_actor)) {
                        this.energy = _energyPerAction.ATTACK;
                        return callback;
                    }
                    else {
                        _confirmEnergy = _energyPerAction.ATTACK;
                        _wantConfirm = true;
                        _confirmCallback = callback;
                        RG.gameMsg("Press 'y' to attack non-hostile actor.");
                        return null;
                    }
                }
                else {
                    this.energy = 0;
                    RG.gameMsg("You cannot move that way.");
                    return null;
                }
            }
        }
        else if (type === "REST") {
            this.energy = _energyPerAction.REST;
            return function() {};
        }

        return null; // Null action
    };

    this.addEnemy = function(actor) {};

}; // }}} Brain.Player

/** Memory is used by the actor to hold information about enemies, items etc.
 * It's a separate object from decision-making brain.*/
RG.Brain.Memory = function(brain) {

    var _enemies = []; // List of enemies for this actor
    var _enemyTypes = []; // List of enemy types for this actor
    var _communications = [];

    this.addEnemyType = function(type) {_enemyTypes.push(type);};

    /** Checks if given actor is an enemy. */
    this.isEnemy = function(actor) {
        var index = _enemies.indexOf(actor);
        if (index !== -1) return true;
        var type = actor.getType();
        index = _enemyTypes.indexOf(type);
        if (index !== -1) return true;
        return false;
    };

    /** Adds given actor as (personal) enemy.*/
    this.addEnemy = function(actor) {
        if (!this.isEnemy(actor)) {
            _enemies.push(actor);
            _communications = []; // Invalidate communications
        }
    };

    this.getEnemies = function() {return _enemies;};

    /** Adds a communication with given actor. */
    this.addCommunicationWith = function(actor) {
        if (!this.hasCommunicatedWith(actor)) {
            _communications.push(actor);
        }
    };

    /** Returns true if has communicated with given actor.*/
    this.hasCommunicatedWith = function(actor) {
        var index = _communications.indexOf(actor);
        return index !== -1;
    };

};

/** Brain is used by the AI to perform and decide on actions. Brain returns
 * actionable callbacks but doesn't know Action objects.  */
RG.Brain.Rogue = function(actor) { // {{{2

    var _actor = actor; // Owner of the brain
    var _explored = {}; // Memory of explored cells

    var _memory = new RG.Brain.Memory(this);

    this.getMemory = function() {return _memory;};

    this.setActor = function(actor) {_actor = actor;};
    this.getActor = function() {return _actor;};

    this.addEnemy = function(actor) {_memory.addEnemy(actor);};

    var passableCallback = function(x, y) {
        var map = _actor.getLevel().getMap();
        if (!RG.isNullOrUndef([map])) {
            var res = map.isPassable(x, y);
            if (!res) {
                res = (x === _actor.getX()) && (y === _actor.getY());
            }
            return res;
        }
        else {
            RG.err("Brain", "passableCallback", "_map not well defined.");
        }
        return false;
    };

    // Convenience methods (for child classes)
    this.getSeenCells = function() {
        return _actor.getLevel().getMap().getVisibleCells(_actor);
    };

    /** Main function for retrieving the actionable callback. Acting actor must
     * be passed in. */
    this.decideNextAction = function(obj) {
        var seenCells = this.getSeenCells();
        var playerCell = this.findEnemyCell(seenCells);

        // We have found the player
        if (!RG.isNullOrUndef([playerCell])) { // Move or attack
            return this.actionTowardsEnemy(playerCell);
        }
        return this.exploreLevel(seenCells);
    };

    /** Takes action towards given enemy cell.*/
    this.actionTowardsEnemy = function(enemyCell) {
        var level = _actor.getLevel();
        var playX = enemyCell.getX();
        var playY = enemyCell.getY();
        if (this.canAttack(playX, playY)) {
            return function() {
                var cell = level.getMap().getCell(playX, playY);
                var target = cell.getProp("actors")[0];
                var attackComp = new RG.Component.Attack(target);
                _actor.add("Attack", attackComp);
            };
        }
        else { // Move closer
            var pathCells = this.getShortestPathTo(enemyCell);
            if (pathCells.length > 1) {
                var pathX = pathCells[1].getX();
                var pathY = pathCells[1].getY();
                return function() {
                    var movComp = new RG.Component.Movement(pathX, pathY, level);
                    _actor.add("Movement", movComp);
                };
            }
            else { // Cannot move anywhere, no action
                return function() {};
            }
        }
    };

    this.exploreLevel = function(seenCells) {
        var level = _actor.getLevel();
        // Wander around exploring
        var index = -1;
        for (var i = 0, ll = seenCells.length; i < ll; i++) {
            if (seenCells[i].isFree()) {
                var xy = seenCells[i].getX() + "," + seenCells[i].getY();
                if (!_explored.hasOwnProperty(xy)) {
                    _explored[xy] = true;
                    index = i;
                    break;
                }
            }
        }

        if (index === -1) { // Everything explored, choose random cell
            index = Math.floor(Math.random() * (seenCells.length));
        }
        return function() {
            var x = seenCells[index].getX();
            var y = seenCells[index].getY();
            var movComp = new RG.Component.Movement(x, y, level);
            _actor.add("Movement", movComp);
        };

    };

    /** Checks if the actor can attack given x,y coordinate.*/
    this.canAttack = function(x, y) {
        var actorX = _actor.getX();
        var actorY = _actor.getY();
        var attackRange = _actor.get("Combat").getAttackRange();
        var getDist = RG.shortestDist(x, y, actorX, actorY);
        if (getDist <= attackRange) return true;
        return false;
    };

    /** Given a list of cells, returns a cell with an enemy in it or null.*/
    this.findEnemyCell = function(seenCells) {
        for (var i = 0, iMax=seenCells.length; i < iMax; i++) {
            if (seenCells[i].hasProp("actors")) {
                var actors = seenCells[i].getProp("actors");
                if (actors[0].isPlayer()) return seenCells[i];
                else if (_memory.isEnemy(actors[0])) return seenCells[i];
            }
        }
        return null;
    };

    /** Returns shortest path from actor to the given cell. Resulting cells are
     * returned in order: closest to the actor first. Thus moving to next cell
     * can be done by taking the first returned cell.*/
    this.getShortestPathTo = function(cell) {
        var path = [];
        var toX = cell.getX();
        var toY = cell.getY();
        var pathFinder = new ROT.Path.Dijkstra(toX, toY, passableCallback);
        var map = _actor.getLevel().getMap();
        var sourceX = _actor.getX();
        var sourceY = _actor.getY();

        if (RG.isNullOrUndef([toX, toY, sourceX, sourceY])) {
            RG.err("Brain", "getShortestPathTo", "Null/undef coords.");
        }

        pathFinder.compute(sourceX, sourceY, function(x, y) {
            if (map.hasXY(x, y)) {
                path.push(map.getCell(x, y));
            }
        });
        return path;
    };

}; // }}} RogueBrain

/** Brain used by most of the animals. TODO: Add some corpse eating behaviour. */
RG.Brain.Animal = function(actor) {
    RG.Brain.Rogue.call(this, actor);

    var _memory = this.getMemory();
    _memory.addEnemyType("player");
    _memory.addEnemyType("human");

    this.findEnemyCell = function(seenCells) {
        for (var i = 0, iMax=seenCells.length; i < iMax; i++) {
            if (seenCells[i].hasProp("actors")) {
                var actors = seenCells[i].getProp("actors");
                if (_memory.isEnemy(actors[0]))
                    return seenCells[i];
            }
        }
        return null;
    };

};
RG.extend2(RG.Brain.Animal, RG.Brain.Rogue);

/** Brain used by most of the animals. TODO: Add some corpse eating behaviour. */
RG.Brain.Demon = function(actor) {
    RG.Brain.Rogue.call(this, actor);

    var _memory = this.getMemory();
    _memory.addEnemyType("player");
    _memory.addEnemyType("human");

    this.findEnemyCell = function(seenCells) {
        var memory = this.getMemory();
        for (var i = 0, iMax=seenCells.length; i < iMax; i++) {
            if (seenCells[i].hasProp("actors")) {
                var actors = seenCells[i].getProp("actors");
                if (memory.isEnemy(actors[0]))
                    return seenCells[i];
            }
        }
        return null;
    };

};
RG.extend2(RG.Brain.Demon, RG.Brain.Rogue);


RG.Brain.Zombie = function(actor) {
    RG.Brain.Rogue.call(this, actor);
};
RG.extend2(RG.Brain.Zombie, RG.Brain.Rogue);

/** Brain used by summoners. */
RG.Brain.Summoner = function(actor) {
    RG.Brain.Rogue.call(this, actor);

    var _actor = actor;
    this.numSummoned = 0;
    this.maxSummons = 20;

    var _memory = this.getMemory();
    _memory.addEnemyType("player");

    this.decideNextAction = function(obj) {
        var level = _actor.getLevel();
        var seenCells = this.getSeenCells();
        var playerCell = this.findEnemyCell(seenCells);

        // We have found the player
        if (!RG.isNullOrUndef([playerCell])) { // Move or attack
            if (this.summonedMonster()) {
                return function() {};
            }
            else {
                return this.actionTowardsEnemy(playerCell);
            }
        }
        return this.exploreLevel(seenCells);

    };

    /** Tries to summon a monster to a nearby cell. Returns true if success.*/
    this.summonedMonster = function() {
        if (this.numSummoned === this.maxSummons) return false;

        var summon = Math.random();
        if (summon > 0.8) {
            var level = _actor.getLevel();
            var cellsAround = this.getFreeCellsAround();
            if (cellsAround.length > 0) {
                var freeX = cellsAround[0].getX();
                var freeY = cellsAround[0].getY();
                var summoned = RG.FACT.createMonster("Summoned",
                    {hp: 15, att: 7, def: 7});
                summoned.get("Experience").setExpLevel(5);
                level.addActor(summoned, freeX, freeY);
                RG.gameMsg(_actor.getName() + " summons some help");
                this.numSummoned += 1;
                return true;
            }
            else {
                var txt = " screamed incantation but nothing happened";
                RG.gameMsg(_actor.getName() + txt);
            }
        }
        return false;

    };

    /** Returns a list of cells in 3x3 around the actor with the brain.*/
    this.getCellsAround = function() {
        var map = _actor.getLevel().getMap();
        var x = _actor.getX();
        var y = _actor.getY();
        var cells = [];
        for (var xx = x-1; xx <= x+1; xx++) {
            for (var yy = y-1; yy <= y+1; yy++) {
                if (map.hasXY(xx, yy))
                    cells.push(map.getCell(xx, yy));
            }
        }
        return cells;
    };

    this.getFreeCellsAround = function() {
        var cellAround = this.getCellsAround();
        var freeCells = [];
        for (var i = 0; i < cellAround.length; i++) {
            if (cellAround[i].isFree()) freeCells.push(cellAround[i]);
        }
        return freeCells;
    };

};
RG.extend2(RG.Brain.Summoner, RG.Brain.Rogue);

/** This brain is used by humans who are not hostile to the player.*/
RG.Brain.Human = function(actor) {
    RG.Brain.Rogue.call(this, actor);
    var _actor = actor;

    this.getMemory().addEnemyType("demon");

    this.decideNextAction = function(obj) {
        var level = _actor.getLevel();
        var seenCells = this.getSeenCells();
        var enemyCell = this.findEnemyCell(seenCells);
        var friendCell = this.findFriendCell(seenCells);
        var friendActor = null;
        var memory = this.getMemory();

        var comOrAttack = Math.random();
        if (RG.isNullOrUndef([friendCell])) {
            comOrAttack = 1.0;
        }
        else {
            friendActor = friendCell.getProp("actors")[0];
            if (memory.hasCommunicatedWith(friendActor)) {
                comOrAttack = 1.0;
            }
        }

        // We have found the enemy
        if (!RG.isNullOrUndef([enemyCell]) && comOrAttack > 0.5) { // Move or attack
            return this.actionTowardsEnemy(enemyCell);
        }
        else {
            if (friendActor !== null) { // Communicate enemies
                if (!memory.hasCommunicatedWith(friendActor)) {
                    var comComp = new RG.Component.Communication();
                    var enemies = memory.getEnemies();
                    var msg = {type: "Enemies", enemies: enemies};
                    comComp.addMsg(msg);
                    if (!friendActor.has("Communication")) {
                        friendActor.add("Communication", comComp);
                        memory.addCommunicationWith(friendActor);
                        return function() {};
                    }
                }
            }
        }
        return this.exploreLevel(seenCells);

    };

    this.findEnemyCell = function(seenCells) {
        var memory = this.getMemory();
        for (var i = 0, iMax=seenCells.length; i < iMax; i++) {
            if (seenCells[i].hasProp("actors")) {
                var actors = seenCells[i].getProp("actors");
                if (memory.isEnemy(actors[0]))
                    return seenCells[i];
            }
        }
        return null;
    };

    /** Finds a friend cell among seen cells.*/
    this.findFriendCell = function(seenCells) {
        var memory = this.getMemory();
        for (var i = 0, iMax=seenCells.length; i < iMax; i++) {
            if (seenCells[i].hasProp("actors")) {
                var actors = seenCells[i].getProp("actors");
                if (actors[0] !== _actor) { // Exclude itself
                    if (!memory.isEnemy(actors[0])) return seenCells[i];
                }
            }
        }
        return null;
    };

};

RG.extend2(RG.Brain.Human, RG.Brain.Rogue);

/** Brain object used by Spirit objects.*/
RG.Brain.Spirit = function(actor) {
    RG.Brain.Rogue.call(this, actor);
    var _actor = actor;

    /** Returns the next action for the spirit.*/
    this.decideNextAction = function(obj) {
        var seenCells = this.getSeenCells();
        return this.exploreLevel(seenCells);
    };
};
RG.extend2(RG.Brain.Spirit, RG.Brain.Rogue);

// }}} BRAINS

if (typeof module !== "undefined" && typeof exports !== "undefined") {
    GS.exportSource(module, exports, ["RG", "Brain"], [RG, RG.Brain]);
}
else {
    GS.exportSource(undefined, undefined, ["RG", "Brain"], [RG, RG.Brain]);
}