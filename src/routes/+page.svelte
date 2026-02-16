<script lang="ts">
	import HeroSection from "$lib/components/homepage/HeroSection.svelte";
	import FeaturesSection from "$lib/components/homepage/FeaturesSection.svelte";
	import HowItWorks from "$lib/components/homepage/HowItWorks.svelte";
	import PricingSection from "$lib/components/homepage/PricingSection.svelte";
	import FAQSection from "$lib/components/homepage/FAQSection.svelte";
	import Footer from "$lib/components/homepage/Footer.svelte";

	const siteUrl = "https://bingwu.ai";
	const title = "BingWu AI - AI 智能创作平台 | 文字生图 · 智能对话";
	const description = "BingWu AI 是一站式 AI 创作平台，提供文字生图、图生图和 AI 智能对话功能。按需付费，积分制计费，即刻释放你的创造力。";

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"name": "BingWu AI",
		"applicationCategory": "MultimediaApplication",
		"operatingSystem": "Web",
		"description": description,
		"url": siteUrl,
		"offers": {
			"@type": "Offer",
			"price": "0",
			"priceCurrency": "CNY",
			"description": "积分制按需付费"
		}
	};
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<meta name="keywords" content="AI 图片生成, AI 对话, 文字生图, 图生图, 人工智能, AI 创作平台, BingWu AI" />
	<link rel="canonical" href={siteUrl} />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={siteUrl} />
	<meta property="og:site_name" content="BingWu AI" />
	<meta property="og:locale" content="zh_CN" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />

	<!-- JSON-LD -->
	{@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`}
</svelte:head>

<main>
	<HeroSection />
	<FeaturesSection />
	<HowItWorks />
	<PricingSection />
	<FAQSection />
</main>
<Footer />
