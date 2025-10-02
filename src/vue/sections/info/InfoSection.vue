<template>
    <SectionTemplate :section-data="props.sectionData">
        <!-- Filters and pagination controls for publications -->
        <div v-if="props.sectionData['content']['subcategories']?.some(sc => sc.id === 'publication')" class="mb-4">
            <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                <select v-model="typeFilter" class="form-select" style="max-width:180px">
                    <option value="">All Types</option>
                    <option value="conference">Conference</option>
                    <option value="journal">Journal</option>
                    <option value="workshop">Workshop</option>
                </select>
                <select v-model="yearFilter" class="form-select" style="max-width:120px">
                    <option value="">All Years</option>
                    <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
                </select>
                <select v-model="keywordFilter" class="form-select" style="max-width:180px">
                    <option value="">All Keywords</option>
                    <option v-for="keyword in availableKeywords" :key="keyword" :value="keyword">{{ keyword }}</option>
                </select>
            </div>
        </div>
        <div class="info-row row gx-4 gx-xl-5">
            <div v-for="subcategory in props.sectionData['content']['subcategories']" class="col-12 subcategory-col">
                <!-- Subcategory Title -->
                <SubHeading v-if="subcategory['locales']['title']"
                            :title="subcategory['locales']['title']"
                            :fa-icon="subcategory['faIcon']"/>
                <!-- Publications: add transition and pagination -->
                <transition-group name="fade" tag="div" v-if="subcategory.id === 'publication'">
                    <component
                        :is="_getComponentFor(subcategory)"
                        :items="_fetchAndParseItemsFor(subcategory)"/>
                </transition-group>
                <!-- Other subcategories -->
                <component
                    v-if="subcategory.id !== 'publication'"
                    :is="_getComponentFor(subcategory)"
                    :items="_fetchAndParseItemsFor(subcategory)"/>
                <!-- Pagination controls -->
                <div v-if="subcategory.id === 'publication' && totalPages > 1" class="mt-3 text-center">
                    <nav aria-label="Page navigation">
                        <ul class="pagination justify-content-center">
                            <li class="page-item" :class="{disabled: page === 1}">
                                <button class="page-link" @click="setPage(page - 1)">&laquo;</button>
                            </li>
                            <li v-for="p in totalPages" :key="p" class="page-item" :class="{active: page === p}">
                                <button class="page-link" @click="setPage(p)">{{ p }}</button>
                            </li>
                            <li class="page-item" :class="{disabled: page === totalPages}">
                                <button class="page-link" @click="setPage(page + 1)">&raquo;</button>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    </SectionTemplate>
</template>

<script setup>
import SectionTemplate from "../_templates/SectionTemplate.vue"
import SubHeading from "../_templates/SubHeading.vue"

import InfoList from "./layouts/InfoList.vue"
import InfoGrid from "./layouts/InfoGrid.vue"
import InfoPie from "./layouts/InfoPie.vue"

import {useLayout} from "../../../composables/layout.js"
import {useUtils} from "../../../composables/utils.js"
import {useData} from "../../../composables/data.js"
import { ref, computed } from 'vue'

/**
 * @property {Object} sectionData
 */
const props = defineProps({
    sectionData: Object
})

const data = useData()
const layout = useLayout()
const utils = useUtils()

/**
 * @const
 */
const COMPONENTS_MAP = {
    grid: InfoGrid,
    pie: InfoPie,
    list: InfoList,
    fallback: InfoList
}

/**
 * @const
 * @type {Object}
 */
const STYLE_PREFERENCES = layout.getStylePreferencesForPlugins()

const typeFilter = ref("")
const yearFilter = ref("")
const keywordFilter = ref("")
const page = ref(1)
const pageSize = 10

const totalPages = computed(() => {
    return Math.ceil(filteredItems.value.length / pageSize)
})

function setPage(p) {
    if (p >= 1 && p <= totalPages.value) {
        page.value = p
    }
}

/**
 * @param {Object} subcategory
 * @private
 */
const _getComponentFor = (subcategory) => {
    const dataType = subcategory['type']
    return COMPONENTS_MAP[dataType] || COMPONENTS_MAP['fallback']
}

/**
 * @param subcategory
 * @return {Object[]}
 * @private
 */
const _fetchAndParseItemsFor = (subcategory) => {
    if (subcategory.id === 'publication') {
        return paginatedItems.value
    }
    const items = props.sectionData['content']['items'][subcategory['id']]
    let colorIdCount = 0
    for(const item of items) {
        item.customColor = STYLE_PREFERENCES.colors.random[colorIdCount]
        colorIdCount++
        if(subcategory['progress']) {
            const percentage = item['value']
            const breakpoints = subcategory['progress']
            const parsedPercentage = utils.parsePercentage(percentage, breakpoints)
            item['formattedPercentage'] = typeof breakpoints !== 'string'
                ? data.getString(parsedPercentage)
                : parsedPercentage
        }
    }
    return items
}

function getPublicationItems() {
    const subcategories = props.sectionData['content']['subcategories'] || []
    const pubSubcat = subcategories.find(sc => sc.id === 'publication')
    if (!pubSubcat) return []
    const items = props.sectionData['content']['items']['publication'] || []
    return items.map(item => ({
        ...item,
        type: item.type || '',
        date: item.date || '',
        year: item.year ? item.year.toString() : '',
        keywords: item.keywords || [],
    }))
}

const filteredItems = computed(() => {
    let items = getPublicationItems()
    if (typeFilter.value) {
        items = items.filter(item => item.type === typeFilter.value)
    }
    if (yearFilter.value) {
        items = items.filter(item => item.year === yearFilter.value)
    }
    if (keywordFilter.value) {
        items = items.filter(item => item.keywords && item.keywords.includes(keywordFilter.value))
    }
    items = items.sort((a, b) => new Date(b.date) - new Date(a.date))
    return items
})

const paginatedItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return filteredItems.value.slice(start, start + pageSize)
})

const hasMore = computed(() => filteredItems.value.length > page.value * pageSize)

function nextPage() {
    page.value++
}

// Get unique years and keywords for filters
const availableYears = computed(() => {
    const years = getPublicationItems().map(item => item.year).filter(y => y)
    return Array.from(new Set(years)).sort((a, b) => b - a)
})
const availableKeywords = computed(() => {
    const allKeywords = getPublicationItems().flatMap(item => item.keywords || [])
    return Array.from(new Set(allKeywords)).sort()
})
</script>

<style lang="scss" scoped>
@import "/src/scss/_theming.scss";

.subcategory-col {
    &:not(:last-child) {
        @include generate-dynamic-styles-with-hash((
            xxxl: (margin-bottom: 2.75rem),
            xl:   (margin-bottom: 1.5rem)
        ));
    }
}

.info-row {
    overflow-x:hidden;
}
</style>