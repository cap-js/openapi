const { describe, test } = require('node:test');
const assert = require('node:assert');
const { Diagram } = require('../../../lib/compile/diagram');
const { CSDLMeta } = require('../../../lib/compile/csdl');

function makeDiagram(csdl) {
  return new Diagram(new CSDLMeta(csdl));
}

/** Extract the DSL string from the first yuml.me URL in the diagram markdown. */
function extractDsl(diagramMarkdown) {
  // Match everything between /plain/ and the last .svg before ) or ]
  const match = diagramMarkdown.match(/\/plain\/(.+?)\.svg(?=[)\]])/);
  return match ? decodeURIComponent(match[1]) : '';
}

describe('Diagram', () => {
  describe('getResourceDiagram', () => {
    test('returns empty string for empty entity container', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { $Kind: 'Schema', EntityContainer: { $Kind: 'EntityContainer' } },
      };
      assert.strictEqual(makeDiagram(csdl).getResourceDiagram({}), '');
    });

    test('generates diagram markdown with heading, ER link and legend for non-empty container', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { Order: { $Kind: 'EntityType' } },
      };
      const result = makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      });
      assert.ok(result.includes('### Entity Data Model'), 'should include heading');
      assert.ok(result.includes('ER Diagram'), 'should include ER diagram link');
      assert.ok(result.includes('Legend'), 'should include legend');
    });

    test('entity type uses lightslategray color', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { Order: { $Kind: 'EntityType' } },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('[Order{bg:lightslategray}]'), 'entity type should carry lightslategray color');
    });

    test('complex type is included without entity color', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Address: { $Kind: 'ComplexType' },
          Customer: {
            $Kind: 'EntityType',
            HomeAddress: { $Type: 'My.Service.Address' },
          },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Customers: { $Type: 'My.Service.Customer', $Collection: true },
      }));
      assert.ok(dsl.includes('[Address]'), 'complex type should appear without extra color');
      assert.ok(!dsl.includes('[Address{'), 'complex type should not have a color annotation');
    });

    test('inheritance is depicted with base-type arrow', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Base: { $Kind: 'EntityType' },
          Child: { $Kind: 'EntityType', $BaseType: 'My.Service.Base' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Children: { $Type: 'My.Service.Child', $Collection: true },
      }));
      assert.ok(dsl.includes('[Base]^[Child'), 'should show ^-arrow from base type');
    });

    test('navigation property links source and target type', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Items: { $Kind: 'NavigationProperty', $Type: 'My.Service.Item', $Collection: true },
          },
          Item: { $Kind: 'EntityType' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('[Order]'), 'should include Order type');
      assert.ok(dsl.includes('[Item]'), 'should include Item type');
      assert.ok(dsl.includes('[Order]-'), 'should have arrow from Order');
    });

    test('containment navigation property uses ++ notation', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Items: { $Kind: 'NavigationProperty', $Type: 'My.Service.Item', $Collection: true, $ContainsTarget: true },
          },
          Item: { $Kind: 'EntityType' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('[Order]++-'), 'containment should use ++ notation');
    });

    test('entity set node is disambiguated from entity type node with ZWNJ', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { Order: { $Kind: 'EntityType' } },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('Orders‌'), 'entity set node should carry ZWNJ (U+200C)');
    });

    test('singleton resource node uses lawngreen color', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { Config: { $Kind: 'EntityType' } },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        AppConfig: { $Type: 'My.Service.Config' },
      }));
      assert.ok(dsl.includes('AppConfig‌{bg:lawngreen}'), 'singleton should use lawngreen');
    });

    test('unbound action import node appears in diagram', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          ResetAll: [{ $Kind: 'Action' }],
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Reset: { $Action: 'My.Service.ResetAll' },
      }));
      assert.ok(dsl.includes('[Reset{bg:lawngreen}]'), 'action import should appear as resource node');
    });

    test('unbound function import node appears in diagram', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          TopItems: [{ $Kind: 'Function', $ReturnType: { $Type: 'My.Service.Item', $Collection: true } }],
          Item: { $Kind: 'EntityType' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        BestItems: { $Function: 'My.Service.TopItems' },
      }));
      assert.ok(dsl.includes('[BestItems{bg:lawngreen}]'), 'function import should appear as resource node');
    });

    test('generated ER URL points to yuml.me and is properly encoded', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': { Order: { $Kind: 'EntityType' } },
      };
      const result = makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      });
      assert.ok(result.includes('app.yuml.me'), 'should point to yuml.me');
      const urlMatch = result.match(/\(https:\/\/app\.yuml\.me[^)]+\)/);
      assert.ok(urlMatch, 'should contain a URL in parentheses');
      assert.ok(!urlMatch[0].includes(' '), 'URL should not contain unencoded spaces');
    });

    test('bidirectional nav property is depicted only once', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Items: { $Kind: 'NavigationProperty', $Type: 'My.Service.Item', $Collection: true, $Partner: 'Order' },
          },
          Item: {
            $Kind: 'EntityType',
            Order: { $Kind: 'NavigationProperty', $Type: 'My.Service.Order', $Partner: 'Items' },
          },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      const arrows = (dsl.match(/\[Order\][^,]*\[Item\]|\[Item\][^,]*\[Order\]/g) || []);
      assert.strictEqual(arrows.length, 1, 'bidirectional nav property should produce exactly one arrow');
    });

    test('collection nav property shows * cardinality', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Items: { $Kind: 'NavigationProperty', $Type: 'My.Service.Item', $Collection: true },
          },
          Item: { $Kind: 'EntityType' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('-*>'), 'collection nav property should show * cardinality');
    });

    test('nullable nav property shows 0..1 cardinality', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Customer: { $Kind: 'NavigationProperty', $Type: 'My.Service.CustomerType', $Nullable: true },
          },
          CustomerType: { $Kind: 'EntityType' },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('-0..1>'), 'nullable nav property should show 0..1 cardinality');
    });

    test('external type (unresolved) carries whitesmoke background', () => {
      const csdl = {
        $Version: '4.01',
        'My.Service': {
          Order: {
            $Kind: 'EntityType',
            Ext: { $Type: 'External.SomeType' },
          },
        },
      };
      const dsl = extractDsl(makeDiagram(csdl).getResourceDiagram({
        Orders: { $Type: 'My.Service.Order', $Collection: true },
      }));
      assert.ok(dsl.includes('whitesmoke'), 'unresolved external type should carry whitesmoke color');
    });
  });
});
