<?php
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');

$rawId = $_GET['p'] ?? ($_GET['photo'] ?? '');
$photoId = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)$rawId);

$siteUrl = 'https://photoearn.chasherdokan.com';
$targetUrl = $photoId !== '' ? ($siteUrl . '/?p=' . urlencode($photoId)) : ($siteUrl . '/');

// আসল মানুষ ব্রাউজারে ঢুকলে সরাসরি গ্যালারি + ছবির মডালে পাঠিয়ে দেবে; শুধুমাত্র সোশ্যাল বট হলে OG মেটা কার্ড দেখাবে
$ua = strtolower((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
$isBot = (bool)preg_match('/facebookexternalhit|facebot|whatsapp|telegrambot|twitterbot|discordbot|slackbot|linkedinbot|pinterest|googlebot/', $ua);

if (!$isBot) {
    header('Location: ' . $targetUrl, true, 302);
    exit;
}

$title = 'Photo Earn - সেরা ছবির জন্য প্রতিদিন নগদ পুরস্কার!';
$desc  = 'আপনার তোলা ছবি আপলোড করুন, ভোট পান আর জিতে নিন ২৪ ঘণ্টা, ৭ দিন ও ৩০ দিনের মেগা ক্যাশ প্রাইজ।';
$image = $siteUrl . '/images/og-preview.png?v=2';
$imgType = 'image/png';
$hasDims = true;

$photosFile = __DIR__ . '/data/photos.json';
if ($photoId !== '' && file_exists($photosFile)) {
    $raw = @file_get_contents($photosFile);
    $photos = $raw ? json_decode($raw, true) : null;
    if (is_array($photos)) {
        foreach ($photos as $p) {
            if (($p['id'] ?? '') === $photoId && (($p['approved'] ?? true) !== false)) {
                $pTitle = trim((string)($p['title'] ?? ''));
                $author = trim((string)($p['authorName'] ?? 'শিল্পী'));
                $votes  = intval($p['votes'] ?? 0);
                $title  = ($pTitle !== '' ? $pTitle : 'সুন্দর ফটোগ্রাফি') . ' — Photo Earn কনটেস্টে ভোট দিন!';
                $desc   = "শিল্পী: {$author} | ❤️ {$votes} ভোট — আপনার পছন্দের ছবিতে ভোট দিন ও ছবি দিয়ে প্রতিদিন টাকা আয় করুন!";
                $pUrl   = trim((string)($p['url'] ?? ''));
                if ($pUrl !== '') {
                    if (stripos($pUrl, 'http://') === 0 || stripos($pUrl, 'https://') === 0) {
                        $image = $pUrl;
                    } else {
                        $image = $siteUrl . '/' . ltrim($pUrl, '/');
                    }
                    $imgType = (stripos($image, '.png') !== false) ? 'image/png' : ((stripos($image, '.webp') !== false) ? 'image/webp' : 'image/jpeg');
                    $hasDims = false;
                }
                break;
            }
        }
    }
}

$e = function($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
};
$canonicalShare = $photoId !== '' ? ($siteUrl . '/share.php?p=' . urlencode($photoId)) : ($siteUrl . '/');
?>
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title><?= $e($title) ?></title>
  <meta name="description" content="<?= $e($desc) ?>">
  <link rel="canonical" href="<?= $e($canonicalShare) ?>">
  <meta property="og:site_name" content="Photo Earn">
  <meta property="og:type" content="website">
  <meta property="og:url" content="<?= $e($canonicalShare) ?>">
  <meta property="og:title" content="<?= $e($title) ?>">
  <meta property="og:description" content="<?= $e($desc) ?>">
  <meta property="og:image" content="<?= $e($image) ?>">
  <meta property="og:image:secure_url" content="<?= $e($image) ?>">
  <meta property="og:image:type" content="<?= $e($imgType) ?>">
<?php if ($hasDims): ?>
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
<?php endif; ?>
  <meta property="og:image:alt" content="<?= $e($title) ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= $e($title) ?>">
  <meta name="twitter:description" content="<?= $e($desc) ?>">
  <meta name="twitter:image" content="<?= $e($image) ?>">
  <meta http-equiv="refresh" content="0;url=<?= $e($targetUrl) ?>">
</head>
<body>
  <p><a href="<?= $e($targetUrl) ?>"><?= $e($title) ?></a></p>
</body>
</html>

