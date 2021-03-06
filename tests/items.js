
var chai = require("chai");
var expect = chai.expect;

var RG = require("../battles.js");
var Slot = RG.Inv.EquipSlot;
var Actor = RG.Actor.Rogue;

var Item = RG.Item.Base;

describe('How items are physical entities', function() {
    it('Has weight and size', function() {
        var item = new Item("TestItem");
        expect(item.has("Physical")).to.equal(true);

        item.setWeight(3.0);
        expect(item.get("Physical").getWeight()).to.equal(3.0);
        expect(item.getWeight()).to.equal(3.0);

        var clonedItem = item.clone();
        expect(item.equals(clonedItem)).to.equal(true);
        expect(clonedItem.equals(item)).to.equal(true);

    });
});

describe('How items are stacked', function() {
    it('Adds two items to create a count of 2', function() {
        var item1 = new RG.Item.Base("Test item");
        item1.setType("test");
        var item2 = new RG.Item.Base("Test item");
        item2.setType("test");
        expect(RG.addStackedItems(item1, item2)).to.equal(true);
        expect(item1.count).to.equal(2);
    });

    it('Stacks weapons correctly', function() {
        var weapon1 = new RG.Item.Weapon("Short sword");
        weapon1.setAttack(3);
        var weapon2 = new RG.Item.Weapon("Short sword");
        weapon2.setAttack(3);
        expect(weapon1.equals(weapon2)).to.equal(true);

        expect(RG.addStackedItems(weapon1, weapon2)).to.equal(true);

        var weapon3 = RG.removeStackedItems(weapon1, 1);
        expect(weapon3.getAttack()).to.equal(3);
    });
});

describe('How stackes are broken into multiple items', function() {
    it('Splits item stack into two items', function() {
        var itemStack = new RG.Item.Base("Arrow");
        itemStack.setType("missile");
        itemStack.count = 2;
        var arrow = RG.removeStackedItems(itemStack, 1);
        itemStack.setType("missile");
        expect(arrow.getName()).to.equal("Arrow");

        var hugeStack = new RG.Item.Base("Gold coin");
        hugeStack.setType("gold");
        hugeStack.count = 10000;
        var newStack = new RG.Item.Base("Gold coin");
        newStack.setType("gold");
        newStack.count = 100;

        var rm_ok = true;
        while (hugeStack.count > 9000 && rm_ok) {
            var coin = RG.removeStackedItems(hugeStack, 100);
            rm_ok = RG.addStackedItems(newStack, coin);
            expect(rm_ok).to.equal(true);
            expect(coin.count).to.equal(100);
        }
        expect(newStack.count).to.equal(1100);
        expect(hugeStack.count).to.equal(9000);

        var testStack = new RG.Item.Base("test item");
        testStack.setType("test");
        var stack = RG.removeStackedItems(testStack, 1);
        expect(testStack.count).to.equal(0);

        var two = new RG.Item.Base("test item");
        two.setType("test");
        two.count = 5;
        var rmvTwo = RG.removeStackedItems(two, 5);
        expect(rmvTwo.count).to.equal(5);
        expect(two.count).to.equal(0);


    });

    it('Manages missile items correctly', function() {
        var arrow = new RG.Item.Missile("arrow");
        arrow.setAttack(3);
        var arrow2 = new RG.Item.Missile("arrow");
        arrow2.setAttack(3);
        expect(RG.addStackedItems(arrow, arrow2)).to.equal(true);
        expect(arrow.count).to.equal(2);

        var arrow3 = new RG.Item.Missile("arrow");
        arrow3.setAttack(10);
        expect(RG.addStackedItems(arrow, arrow3)).to.equal(false);
        expect(arrow.count).to.equal(2);

        var rmvArrow = RG.removeStackedItems(arrow, 1);
        expect(arrow.count).to.equal(1);
    });
});

describe('How inventory container works', function() {
    var player = new RG.Actor.Rogue("player");
    var invEq = new RG.Inv.Inventory(player);
    var inv = invEq.getInventory();

    it('Checks items by reference for existence', function() {
        var arrow = new RG.Item.Missile("arrow");
        var arrow2 = new RG.Item.Missile("arrow");
        expect(inv.hasItem(arrow)).to.equal(false);
        inv.addItem(arrow);
        expect(inv.hasItem(arrow)).to.equal(true);
        expect(inv.hasItemRef(arrow2)).to.equal(false);

        // 1. Add two non-count items
        inv.addItem(arrow2);
        expect(inv.first().count).to.equal(2);

        // 2. Add count and non-count items
        var steelArrow4 = new RG.Item.Missile("Steel arrow");
        var steelArrow1 = new RG.Item.Missile("Steel arrow");
        steelArrow4.count = 4;
        inv.addItem(steelArrow4);
        inv.addItem(steelArrow1);
        expect(inv.last().count).to.equal(5);

        // 3. Add non-count and count item
        var rubyArrow1 = new RG.Item.Missile("Ruby arrow");
        var rubyArrow6 = new RG.Item.Missile("Ruby arrow");
        rubyArrow6.count = 6;
        inv.addItem(rubyArrow1);
        inv.addItem(rubyArrow6);
        expect(inv.last().count).to.equal(7);

        // 4. Add two count items
        var ebonyArrow3 = new RG.Item.Missile("Ebony arrow");
        var ebonyArrow5 = new RG.Item.Missile("Ebony arrow");
        ebonyArrow3.count = 3;
        ebonyArrow5.count = 5;
        inv.addItem(ebonyArrow3);
        inv.addItem(ebonyArrow5);
        expect(inv.last().count).to.equal(8);

        arrow.count = 10;
        expect(inv.removeNItems(arrow, 2)).to.equal(true);
        expect(arrow.count).to.equal(8);
        var removed = inv.getRemovedItem();
        expect(removed.count).to.equal(2);

        expect(inv.removeNItems(arrow, 3)).to.equal(true);
        expect(arrow.count).to.equal(5);
        var removed2 = inv.getRemovedItem();
        expect(removed2.count).to.equal(3);

    });
});

describe('How item equipment slots work', function() {
    var player = new RG.Actor.Rogue("player");
    var invEq = new RG.Inv.Inventory(player);
    var eq = invEq.getEquipment();
    var inv = invEq.getInventory();

    it('Holds items or stacks of items', function() {
        var eqSlot = new Slot(eq, "hand", false);
        var missSlot = new Slot(eq, "missile", true);

        var arrow = new RG.Item.Missile("arrow");
        arrow.count = 10;
        expect(missSlot.equipItem(arrow)).to.equal(true);
        expect(missSlot.unequipItem(5)).to.equal(true);

        var arrowStack = missSlot.getItem();
        expect(arrowStack.count).to.equal(5);
        expect(missSlot.unequipItem(5)).to.equal(true);
        var nullArrowStack = missSlot.getItem();
        expect(nullArrowStack === null).to.equal(true);

    });
});

describe('How item stacks work with equipped missiles', function() {
    var player = new RG.Actor.Rogue("player");
    var invEq = new RG.Inv.Inventory(player);
    var inv = invEq.getInventory();
    var eq = invEq.getEquipment();


    it('Stacks item in inv when added individually', function() {
        for (var i = 0; i < 10; i++) {
            var arrow = new RG.Item.Missile("arrow");
            invEq.addItem(arrow);
        }
        var newArrow = inv.first();
        expect(newArrow.count).to.equal(10);

        var sword = new RG.Item.Weapon("sword");
        invEq.addItem(sword);
        expect(invEq.equipItem(sword)).to.equal(true);

        // Add some arrows and test they're seen in inv
        var testArrow = new RG.Item.Missile("Steel arrow");
        testArrow.count = 12;
        invEq.addItem(testArrow);
        expect(invEq.hasItem(testArrow)).to.equal(true);
        expect(testArrow.count).to.equal(12);

        // Check that iterator last() works
        var arrowStack = inv.last();
        expect(arrowStack.count).to.equal(12);

        // Remove all arrows from inv
        expect(invEq.removeNItems(testArrow, 12)).to.equal(true);
        var removedArrows = invEq.getRemovedItem();
        expect(removedArrows.count).to.equal(12);
        expect(testArrow.count).to.equal(0);
        expect(invEq.hasItem(testArrow)).to.equal(false);

        // Add all arrows and equip one of them. Check that stack is decremented
        // by one
        testArrow.count = 12; // Add count back to 12
        invEq.addItem(testArrow); // Add arrows all at once
        expect(testArrow.count).to.equal(12);
        expect(invEq.hasItem(testArrow)).to.equal(true);
        expect(testArrow.count).to.equal(12);
        expect(invEq.equipItem(testArrow)).to.equal(true);
        expect(testArrow.count).to.equal(11);
        var oneArrow = invEq.getEquipped("missile");
        expect(oneArrow.count).to.equal(1);

        // Try to equip non-inv items
        var sixArrows = new RG.Item.Missile("Steel arrow");
        sixArrows.count = 6;
        expect(invEq.equipNItems(sixArrows, 6)).to.equal(true);
        expect(sixArrows.count).to.equal(6);
        //invEq.addItem(sixArrows);
        //expect(invEq.hasItem(sixArrows)).to.equal(true);
        var sevenArrows = invEq.getEquipped("missile");
        expect(sevenArrows.count).to.equal(7);

        var anotherSix = new RG.Item.Missile("Steel arrow");
        anotherSix.count = 6;
        invEq.addItem(anotherSix);
        expect(invEq.equipNItems(anotherSix, 6)).to.equal(true);
        var arrows13 = invEq.getEquipped("missile");
        expect(arrows13.count).to.equal(13);

        var shotArrow = invEq.unequipAndGetItem("missile", 3);
        expect(shotArrow.count).to.equal(3);
        var tenArrows = eq.getItem("missile");
        expect(tenArrows.count).to.equal(10);

        expect(invEq.unequipItem("missile", 1)).to.equal(true);
        var nineArrows = eq.getItem("missile");
        expect(nineArrows.count).to.equal(9);

    });

    it('Equips armour correctly', function() {
        var collar = new RG.Item.Armour("Collar");
        collar.setArmourType("neck");
        inv.addItem(collar);
        expect(invEq.equipItem(collar)).to.equal(true);

        var plate = new RG.Item.Armour("Plate mail");
        plate.setArmourType("chest");
        inv.addItem(plate);
        expect(invEq.equipItem(plate)).to.equal(true);

        var gem = new RG.Item.SpiritGem("Lesser gem");
        expect(gem.hasOwnProperty("getArmourType")).to.equal(true);
        inv.addItem(gem);
        expect(invEq.equipItem(gem)).to.equal(true);
        expect(eq.getStrength()).to.equal(0);

    });

});

var ItemDestroyer = function() {

    this.notify = function(evtName, obj) {
        if (evtName === RG.EVT_DESTROY_ITEM) {
            var item = obj.item;
            var owner = item.getOwner().getOwner();
            owner.getInvEq().removeItem(item);
        }
    };
    RG.POOL.listenEvent(RG.EVT_DESTROY_ITEM, this);
};

describe('How one-shot items are removed after their use', function() {
    it('Player uses a potion and it is destroyed after this.', function() {
        var potion = new RG.Item.Potion("potion")
        var player = new Actor("Player");
        var cell = RG.FACT.createFloorCell();
        cell.setProp("actors", player);
        expect(cell.hasProp("actors")).to.equal(true);
        var invEq = player.getInvEq();
        var itemDestroy = new ItemDestroyer();
        invEq.addItem(potion);

        // Do some damage
        var hp = player.get("Health").getHP();
        player.get("Health").setHP(hp - 5);
        var currHP = player.get("Health").getHP();

        expect(invEq.hasItem(potion)).to.equal(true);
        expect(player.getInvEq().useItem(potion, {target: cell})).to.equal(true);
        expect(player.get("Health").getHP() != currHP).to.equal(true);
        expect(invEq.hasItem(potion)).to.equal(false);

    });
});

