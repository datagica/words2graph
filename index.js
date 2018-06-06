'use strict'

function getNewLink (opts) {
  return Object.assign({}, {
    type: 'link',

    // note: this is in violation with how IDs works
    // in the dabase, because normally IDs should be uniques
    id: 'link:affinity',

    label: {
      en: "Affinity",
      fr: "Affinité",
    },
    plural: {
      en: "Affinities",
      fr: "Affinités",
    },
    distance   : 0,
    occurrences: 0,
    weight     : 0
  }, opts)
}

function defaultGetId       (x) { return x.entity.id }
function defaultGetSentence (x) { return x.position.sentence }
function defaultGetWord     (x) { return x.position.word }

/**
 * Update the distance between two ngrams using a mutable object
 *
 * map     : Map[String, Object]   - where keys are stored
 * list    : Map[String, Object]   - where results are stored
 * source   : Object                - first ngram
 * target   : Object                - second ngram
 * distance: Object                - the computed distance
 * getId   : Function              - getter for the unique id
 */
function addEdge (map, list, source, target, distance, getId) {

  const id1 = getId(source)
  const id2 = getId(target)

  if (id1 === id2) { return }

  const k = (id1 < id2) ? `${id1}⇰⇰${id2}` : `${id2}⇰⇰${id1}`

  if (map[k]) {
    map[k].link.distance    += distance
    map[k].link.occurrences += 1
  } else {
    map[k] = {
      // key: k,
      source: {
        type  : source.type,
        id    : source.id,
        label : source.label,
        plural: source.plural || source.label,
        rank  : source.rank || 0,
        weight: source.weight || 0,
      },
      target: {
        type  : target.type,
        id    : target.id,
        label : target.label,
        plural: target.plural || source.label,
        rank  : target.rank || 0,
        weight: target.weight || 0,
      },
      link: getNewLink({
        distance   : distance,
        occurrences: 1,
        weight     : 0
      })
    }
    list.push(map[k])
  }
  map[k].link.weight = map[k].link.occurrences / Math.max(1, map[k].link.distance)
}




/**
 * Compute the distances between words inside a record (ie. ngram list)
 *
 * Return an array of edges, sorted from the strongest links (low distance) to
 * the weakest links (large distance)
 *
 * Parameters are passed in an object:
 *
 * records    : Array[Map[String,Array[NGram]]]  -
      array of records, a record being a map of label strings (entityTypes
      eg. disease) to arrays of ngrams, sorted by position in the sentence
 * entityType: String    - the category to keep
 * maxDistance: Number    - size of the sliding window when looking at distances between words
 * getId     : Function  - getter for the unique id (type + id)
 * getWordIndex  : Function  - getter for the index
 */
function words2edges (opts) {

  opts = opts || {}

  const positions = Array.isArray(opts.positions) ? opts.positions : []

  // the max distance is the depth of the analysis
  // the scale is as follow:
  // [(1 = word level) ---------- (20 = sentence level) --------- (Infinity : whole document)]
  const maxDistance      = (typeof opts.maxDistance      === 'number')   ? opts.maxDistance      : 30

  const getId            = (typeof opts.getId            === 'function') ? opts.getId            : defaultGetId
  const getSentenceIndex = (typeof opts.getSentenceIndex === 'function') ? opts.getSentenceIndex : defaultGetSentence
  const getWordIndex     = (typeof opts.getWordIndex     === 'function') ? opts.getWordIndex     : defaultGetWord

  // order should be: record -> sentence -> word
  // order is important for the performance boost, and get an N LOG(N) instead of N * N
  // normally, this order can be precomputed during the query, eg:
  /*
  select * from (
  select
    in.id as entityId,
    properties,
    out.id as recordId,
    properties.sentence as sentenceId
    from elink
    where properties.sentence > 0
    order by properties.sentence
) order by out.id
*/
  positions.sort((a, b) => {
    if (a.recordId < b.recordId) { return -1 }
    else if (a.recordId > b.recordId) { return 1 }
    else if (a.position.sentence < b.position.sentence) { return -1 }
    else if (b.position.sentence > a.position.sentence) { return 1 }
    else if (a.position.word < b.position.word) { return -1 }
    else if (b.position.word > a.position.word) { return 1 }
    else { return 0 }
  })

  const tmp = {}
  const results = []

  // for each position
  for (let i = 0; i < opts.positions.length; i++) {
    const item1         = opts.positions[i]
    const item1Sentence = getSentenceIndex(item1)
    const item1Word     = getWordIndex(item1)
    // work till the end of the current position
    for (let j = i + 1; j < opts.positions.length; j++) {
      const item2 = opts.positions[j]
      if (item1.recordId !== item2.recordId) { break } // skip once outside the record
      const item2Sentence = getSentenceIndex(item2)
      if (item1Sentence !== item2Sentence) { break } // skip once outside the sentence
      const item2Word  = getWordIndex(item2)
      const distance = Math.abs(item1Word - item2Word)
      if (distance > maxDistance) { break } // skip if too far from the word
      addEdge(tmp, results, item1, item2, distance, getId)
    }
  }
  return results
}


function words2graph (opts) {
  return words2edges({
    positions        : opts.positions,
    maxDistance      : opts.maxDistance,
    getId            : x => x.id,
    getSentenceIndex : x => x.position.sentence,
    getWordIndex     : x => x.position.word
  })
}

module.exports = {
  words2edges,
  words2graph
}
