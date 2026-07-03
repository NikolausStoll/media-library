import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDnbMarcXml } from '../src/services/dnbService.js'
import { mergeDnbIntoOpenLibrarySource } from '../src/services/bookPreparationService.js'

const BLYTON_MARC_SNIPPET = `<?xml version="1.0" encoding="UTF-8"?>
<searchRetrieveResponse xmlns="http://www.loc.gov/zing/srw/">
  <numberOfRecords>1</numberOfRecords>
  <records><record><recordData><record xmlns="http://www.loc.gov/MARC21/slim">
    <controlfield tag="001">947146164</controlfield>
    <controlfield tag="008">960320s1996    gw ||||| |||| 00||||ger  </controlfield>
    <datafield tag="100" ind1="1" ind2=" ">
      <subfield code="a">Blyton, Enid</subfield>
    </datafield>
    <datafield tag="245" ind1="1" ind2="0">
      <subfield code="a">Geheimnis um einen nächtlichen Brand</subfield>
      <subfield code="b">erstes Erlebnis der sechs Spürnasen</subfield>
    </datafield>
    <datafield tag="264" ind1=" " ind2="1">
      <subfield code="b">Dt. Taschenbuch-Verl.</subfield>
      <subfield code="c">1996</subfield>
    </datafield>
    <datafield tag="300" ind1=" " ind2=" ">
      <subfield code="a">140 S.</subfield>
    </datafield>
    <datafield tag="520" ind1=" " ind2=" ">
      <subfield code="a">Die sechs Spürnasen untersuchen einen nächtlichen Brand.</subfield>
    </datafield>
  </record></recordData></record></records>
</searchRetrieveResponse>`

test('parseDnbMarcXml maps German MARC fields into fallbackDraft', () => {
  const result = parseDnbMarcXml(BLYTON_MARC_SNIPPET, '9783423072489')

  assert.equal(result.hit, true)
  assert.equal(result.recordId, '947146164')
  assert.match(result.fallbackDraft.title, /Geheimnis um einen/)
  assert.deepEqual(result.fallbackDraft.authors, ['Enid Blyton'])
  assert.equal(result.fallbackDraft.publisher, 'Dt. Taschenbuch-Verl.')
  assert.equal(result.fallbackDraft.publishedDate, '1996')
  assert.equal(result.fallbackDraft.pageCount, 140)
  assert.equal(result.fallbackDraft.language, 'de')
  assert.match(result.fallbackDraft.description, /Brand/)
  assert.equal(result.fallbackDraft.sourceName, 'Deutsche Nationalbibliothek')
})

test('mergeDnbIntoOpenLibrarySource fills missing Open Library fields from DNB', () => {
  const source = {
    isbn: '9783423072489',
    edition: null,
    fallbackDraft: {
      title: '',
      authors: [],
      isbn: '9783423072489',
      sourceName: 'Open Library',
      sourceUrl: 'https://openlibrary.org/isbn/9783423072489',
    },
  }
  const dnb = parseDnbMarcXml(BLYTON_MARC_SNIPPET, '9783423072489')
  const merged = mergeDnbIntoOpenLibrarySource(source, dnb)

  assert.equal(merged.dnbUsed, true)
  assert.match(merged.fallbackDraft.title, /Geheimnis/)
  assert.deepEqual(merged.fallbackDraft.authors, ['Enid Blyton'])
  assert.equal(merged.fallbackDraft.publisher, 'Dt. Taschenbuch-Verl.')
  assert.equal(merged.fallbackDraft.sourceName, 'Deutsche Nationalbibliothek')
  assert.deepEqual(merged.dnbFilledFields, ['title', 'authors', 'description', 'pageCount', 'publishedDate', 'publisher', 'language'])
})

test('mergeDnbIntoOpenLibrarySource does not overwrite existing Open Library title', () => {
  const source = {
    isbn: '9783548603209',
    edition: { key: '/books/OL1M' },
    fallbackDraft: {
      title: 'Artemis Fowl',
      authors: ['Eoin Colfer'],
      publisher: 'List',
      language: 'de',
      isbn: '9783548603209',
      sourceName: 'Open Library',
      sourceUrl: 'https://openlibrary.org/isbn/9783548603209',
    },
  }
  const dnb = parseDnbMarcXml(BLYTON_MARC_SNIPPET, '9783548603209')
  const merged = mergeDnbIntoOpenLibrarySource(source, dnb)

  assert.equal(merged.fallbackDraft.title, 'Artemis Fowl')
  assert.equal(merged.fallbackDraft.publisher, 'List')
})
