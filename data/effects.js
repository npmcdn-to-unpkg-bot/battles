

var GS = require("../getsource.js");
var RG  = GS.getSource(["RG"], "./src/rg.js");

RG.Component = GS.getSource(["RG", "Component"], "./src/component.js");


RG.Effects = {

    // Effects can be used in items freely, 'this' is bound to the current item
    // Each obj arg will have {target:cell}
    // Item user is generally item owner: var user = this.getOwner();

    // Each entry is as follows:
    // { name: "effectName", 
    //   func: function(obj) {...},
    //   requires: required args inside item, these can be used inside functions
    //      using this.useArgs.argName.

    // Example: 
    // Given EFFECT:
    // {name: "heal", func: function(obj) {..}, requires: "hp"}
    // The item must be specified in the following way:
    // {
    //  name: "Healing potion", 
    //  use: {heal: {hp: "2d4+8"}}
    // }

    effects: [

        // Generic use function added to all items with use effects
        {
            name: "use",
            func: function(obj) {
                for (var i = 0; i < this.useFuncs.length; i++) {
                    if (this.useFuncs[i].call(this, obj)) return true;
                }
                return false;
            },
        },

        // Cures an effect specified in use: {cure: {effect: Poison}}
        {
            name: "cure",
            requires: ["effect"],
            func: function(obj) {
                if (obj.hasOwnProperty("target")) {
                    var cell = obj.target;
                    if (cell.hasActors()) {
                        var actor = cell.getProp("actors")[0];
                        var effectName = this.useArgs.effect.capitalize();
                        if (actor.has(effectName)) {
                            actor.remove(effectName);
                            RG.gameMsg(actor.getName() + " seems to be cured of " + effectName);
                        }
                        else {
                            RG.gameMsg(this.getName() + " was wasted");
                        }
                        RG.destroyItemIfNeeded(this);
                        return true;
                    }
                }
                return false;
            },

        },

        // Digger effect can be used to dig into stones and rocks
        {
            name: "digger",
            func: function(obj) {
                if (obj.hasOwnProperty("target")) {
                    var cell = obj.target;
                    if (cell.getBaseElem().getType() === "wall") {
                        var owner = this.getOwner();
                        cell.getBaseElem().setType("floor");
                        RG.gameMsg(owner.getName() + " digs through stone with " + this.getName());
                        return true;
                    }
                }
                else {
                    RG.err(this.getName(), "useItem.digger", "No target given in obj.");
                }
                return false;
            },
        },

        // Healing effect restores hit points to the target
        {
            name: "heal",
            requires: ["hp"],
            func: function(obj) {
                if (obj.hasOwnProperty("target")) {
                    var cell = obj.target;
                    if (cell.hasActors()) {
                        var target = cell.getProp("actors")[0];
                        var arr = RG.parseDieSpec(this.useArgs.hp);
                        var die = new RG.Die(arr[0], arr[1], arr[2]);
                        var pt = die.roll();
                        if (target.has("Health")) {
                            target.get("Health").addHP(pt);
                            RG.destroyItemIfNeeded(this);
                            RG.gameMsg(target.getName() + " drinks " + this.getName());
                            return true;
                        }
                    }
                    else {
                        RG.gameWarn("Cannot see anyone there for using the potion.");
                    }
                }
                else {
                    RG.err(this.getName(), "useItem.heal", "No target given in obj.");
                }
                return false;
            },
        }, // heal

        // Poison effect which deals damage for a period of time bypassing any
        // protection
        {
            name: "poison",
            requires: ["duration", "damage", "prob"],
            func: function(obj) {
                if (obj.hasOwnProperty("target")) {
                    var cell = obj.target;
                    if (cell.hasActors()) {
                        var target = cell.getProp("actors")[0];
                        var arr = RG.parseDieSpec(this.useArgs.duration);
                        var durDie = new RG.Die(arr[0], arr[1], arr[2]);
                        var poisonDur = durDie.roll();

                        arr = RG.parseDieSpec(this.useArgs.damage);
                        var dmgDie = new RG.Die(arr[0], arr[1], arr[2]);

                        var poisonComp = new RG.Component.Poison();
                        poisonComp.setDuration(poisonDur);
                        poisonComp.setDamage(dmgDie);

                        var itemOwner = this.getOwner();
                        while (itemOwner.hasOwnProperty("getOwner")) {
                            itemOwner = itemOwner.getOwner();
                        }
                        poisonComp.setProb(this.useArgs.prob);
                        poisonComp.setSource(itemOwner);
                        target.add("Poison", poisonComp);
                        RG.destroyItemIfNeeded(this);
                        return true;
                    }
                }
                return false;
            },
        }, // poison

        // Stun effect
        {
            name: "stun",
            requires: ["duration"],
            func: function(obj) {
                if (obj.hasOwnProperty("target")) {
                    var cell = obj.target;
                    if (cell.hasActors()) {
                        var target = cell.getProp("actors")[0];
                        var arr = RG.parseDieSpec(this.useArgs.duration);
                        var durDie = new RG.Die(arr[0], arr[1], arr[2]);
                        var stunDur = durDie.roll();
                        var stunComp = new RG.Component.Stun();
                        stunComp.setDuration(durDie);
                        target.add("Stun", stunComp);
                        RG.destroyItemIfNeeded(this);
                        return true;
                    }
                }
                return false;
            },
        }, // stun


    ],

};

if (typeof module !== "undefined" && typeof exports !== "undefined") {
    GS.exportSource(module, exports, ["RG", "Effects"], [RG, RG.Effects]);
}
else {
    GS.exportSource(undefined, undefined, ["RG", "Effects"], [RG, RG.Effects]);
}
