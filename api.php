<?php
/**
 * ========================================================
 * 🚀 Photo Earn - Hardened PHP Backend Engine (api.php)
 * Server-Side Admin Session, Auth Hashing & Anti-Cheat API
 * ========================================================
 */

$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? 80) == 443)
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

session_set_cookie_params([
    'lifetime' => 86400,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax'
]);
// নন-ব্লকিং রিড-অনলি সেশন: কেবল সেশন কুকি থাকলে পড়েই সাথে সাথে লক মুক্ত করবে (প্যারালাল রিকোয়েস্ট ফাস্ট করতে)
if (!empty($_COOKIE[session_name()])) {
    session_start(['read_and_close' => true]);
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

// Same-origin / CORS handling
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = $_SERVER['HTTP_HOST'] ?? '';
if ($origin && $host && parse_url($origin, PHP_URL_HOST) === explode(':', $host)[0]) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dataDir   = __DIR__ . '/data';
$uploadDir = __DIR__ . '/uploads';

if (!is_dir($dataDir)) @mkdir($dataDir, 0755, true);
if (!is_dir($uploadDir)) @mkdir($uploadDir, 0755, true);

$photosFile        = $dataDir . '/photos.json';
$usersFile         = $dataDir . '/users.json';
$withdrawsFile     = $dataDir . '/withdraws.json';
$statsFile         = $dataDir . '/stats.json';
$settingsFile      = $dataDir . '/settings.json';
$chatFile          = $dataDir . '/chat.json';
$notifsFile        = $dataDir . '/notifs.json';
$votesLogFile      = $dataDir . '/votes_log.json';
$likesLogFile      = $dataDir . '/likes_log.json';
$followersFile     = $dataDir . '/followers.json';
$adminAuthFile     = $dataDir . '/admin_auth.json';
$adminAttemptsFile = $dataDir . '/admin_attempts.json';
$loginAttemptsFile = $dataDir . '/login_attempts.json';
$ledgerFile        = $dataDir . '/referrals_ledger.json';

// প্রাথমিক অ্যাডমিন পিনের SHA-256 হ্যাশ (সোর্স কোডে প্লেইনটেক্সট পিন রাখা হয়নি)
define('PEG_INIT_PIN_HASH', '3db9f914c5ae28fee256bd211cbd48e6824b56fc3ebed4f5221637de6363912a');
define('PEG_TAKA_PER_POINT', 0.10);
define('PEG_MIN_WITHDRAW_TAKA', 50);
define('PEG_MIN_PHOTOS_WD', 3);

// ===== 🔔 টেলিগ্রাম অ্যালার্ট কনফিগ (ঐচ্ছিক) =====
$tgBotToken = "";
$tgChatId   = "";

function sendTelegramNotification($message) {
    global $tgBotToken, $tgChatId;
    if (empty($tgBotToken) || empty($tgChatId) || !function_exists('curl_init')) return;
    $url = "https://api.telegram.org/bot{$tgBotToken}/sendMessage";
    $ch = curl_init($url);
    if ($ch) {
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, ['chat_id' => $tgChatId, 'text' => $message, 'parse_mode' => 'HTML']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 3);
        curl_exec($ch);
        curl_close($ch);
    }
}

function readJson($file, $default = []) {
    if (!file_exists($file)) return $default;
    $content = @file_get_contents($file);
    if ($content === false || $content === '') return $default;
    $data = json_decode($content, true);
    return is_array($data) ? $data : $default;
}

function writeJson($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function readPhotosSafe($photosFile) {
    $photos = readJson($photosFile, []);
    if (!is_array($photos)) return [];
    $changed = false;
    foreach ($photos as &$p) {
        $id = $p['id'] ?? '';
        $pin = trim((string)($p['authorPin'] ?? ''));
        $author = trim((string)($p['authorName'] ?? ''));
        if ($id === 'photo_1' && ($pin === '1234' || $author === 'তানভীর হাসান') && $pin !== 'demo_tanvir') {
            $p['authorPin'] = 'demo_tanvir';
            $p['authorId']  = makeCreatorId('demo_tanvir');
            $changed = true;
        } elseif ($id === 'photo_2' && ($pin === '2345' || $author === 'রাকিবুল ইসলাম') && $pin !== 'demo_rakib') {
            $p['authorPin'] = 'demo_rakib';
            $p['authorId']  = makeCreatorId('demo_rakib');
            $changed = true;
        }
    }
    unset($p);
    if ($changed) {
        writeJson($photosFile, $photos);
    }
    return $photos;
}

function readUsersSafe($usersFile) {
    $raw = readJson($usersFile, []);
    if (!is_array($raw)) return [];
    $users = [];
    $changed = false;
    foreach ($raw as $k => $u) {
        if (!is_array($u)) continue;
        $id = trim((string)($u['userId'] ?? ($u['id'] ?? '')));
        if ($id === '') {
            $pin = trim((string)($u['pin'] ?? $k));
            $id = 'u_' . (preg_match('/^[a-zA-Z0-9_]+$/', $pin) ? $pin : substr(md5($pin), 0, 10));
            $u['userId'] = $id;
            $u['id']     = $id;
            $changed = true;
        }
        if (empty($u['pin'])) {
            $u['pin'] = (string)$k;
            $changed = true;
        }
        if (empty($u['creatorId'])) {
            $u['creatorId'] = makeCreatorId($u['pin'] ?? $id);
            $changed = true;
        }
        if (empty($u['refCode'])) {
            $u['refCode'] = 'REF' . ($u['pin'] ?? substr($id, 2, 6));
            $changed = true;
        }
        if (!isset($u['blocked'])) {
            $u['blocked'] = false;
            $changed = true;
        }
        $users[$id] = $u;
    }
    if ($changed) {
        writeJson($usersFile, $users);
    }
    return $users;
}

function findUserByIdentifier($users, $identifier) {
    $clean = trim((string)$identifier);
    if ($clean === '') return null;
    $cleanPhone = preg_replace('/[^0-9]/', '', $clean);

    if (isset($users[$clean])) return $users[$clean];

    foreach ($users as $id => $u) {
        $uId    = (string)($u['userId'] ?? ($u['id'] ?? ''));
        $uPin   = (string)($u['pin'] ?? '');
        $uPhone = preg_replace('/[^0-9]/', '', (string)($u['phone'] ?? ''));
        $uCid   = (string)($u['creatorId'] ?? '');

        if ($uId === $clean || $uPin === $clean || $uCid === $clean) return $u;
        if ($cleanPhone !== '' && strlen($cleanPhone) >= 10 && $uPhone !== '') {
            if ($uPhone === $cleanPhone || (strlen($uPhone) >= 10 && substr($uPhone, -10) === substr($cleanPhone, -10))) {
                return $u;
            }
        }
    }
    return null;
}

function findUserByCredentials($users, $phone, $pin) {
    $cleanPhone = preg_replace('/[^0-9]/', '', (string)$phone);
    $cleanPin   = trim((string)$pin);
    if ($cleanPin === '') return null;

    if ($cleanPhone !== '') {
        foreach ($users as $id => $u) {
            $uPhone = preg_replace('/[^0-9]/', '', (string)($u['phone'] ?? ''));
            $uPin   = trim((string)($u['pin'] ?? ''));
            if ($uPhone !== '' && (strlen($uPhone) >= 10 && strlen($cleanPhone) >= 10 && substr($uPhone, -10) === substr($cleanPhone, -10))) {
                if ($uPin === $cleanPin) {
                    return $u;
                }
            }
        }
    }

    // Legacy fallback: single PIN match
    $matches = [];
    foreach ($users as $id => $u) {
        if (trim((string)($u['pin'] ?? '')) === $cleanPin) {
            $matches[] = $u;
        }
    }
    if (count($matches) === 1) {
        return $matches[0];
    }
    return null;
}

function syncMissedReferralsSafe(&$users, &$notifs, $ledgerFile) {
    $ledger = readJson($ledgerFile, []);
    $recoveredCount = 0;
    $changed = false;

    foreach ($users as $refereeId => &$refereeUser) {
        $rawRef = trim((string)($refereeUser['referredBy'] ?? ''));
        if ($rawRef === '') continue;

        $refereeKey = $refereeUser['userId'] ?? $refereeId;
        if (isset($ledger[$refereeKey])) continue;

        $cleanRef = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $rawRef));
        $refCandidate = (strpos($cleanRef, 'REF') === 0) ? substr($cleanRef, 3) : $cleanRef;
        $cleanPhoneRef = preg_replace('/[^0-9]/', '', $rawRef);
        $targetRefId = null;

        foreach ($users as $uId => $u) {
            $uPinClean   = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', (string)($u['pin'] ?? '')));
            $uRefClean   = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', (string)($u['refCode'] ?? '')));
            $uPhoneClean = preg_replace('/[^0-9]/', '', (string)($u['phone'] ?? ''));
            $uIdClean    = strtoupper($uId);

            if (
                $uIdClean === $cleanRef ||
                $uPinClean === $cleanRef ||
                $uPinClean === $refCandidate ||
                $uRefClean === $cleanRef ||
                $uRefClean === ('REF' . $cleanRef) ||
                ($cleanPhoneRef !== '' && strlen($cleanPhoneRef) >= 10 && $uPhoneClean !== '' && substr($uPhoneClean, -10) === substr($cleanPhoneRef, -10))
            ) {
                $targetRefId = $uId;
                break;
            }
        }

        if ($targetRefId !== null && $targetRefId !== $refereeId && isset($users[$targetRefId])) {
            $refereeName = $refereeUser['name'] ?? 'নতুন ব্যবহারকারী';
            if (creditUserInMap($users, $targetRefId, 10, true) !== null) {
                $ledger[$refereeKey] = [
                    "referrerId"    => $targetRefId,
                    "refereeName"   => $refereeName,
                    "date"          => date('c'),
                    "autoRecovered" => true
                ];
                $targetPin = $users[$targetRefId]['pin'] ?? $targetRefId;
                addNotification(
                    $notifs,
                    $targetPin,
                    "🎁 রেফারেল বোনাস রিকভারি!",
                    "আপনার রেফার লিংকে পূর্বে যুক্ত \"{$refereeName}\"-এর রেফারেল বোনাস (+৳1.00 / 10 পয়েন্ট) আপনার অ্যাকাউন্টে সফলভাবে যোগ হয়েছে।",
                    "ok"
                );
                $recoveredCount++;
                $changed = true;
            }
        }
    }
    unset($refereeUser);

    if ($changed) {
        writeJson($ledgerFile, $ledger);
    }
    return [
        "changed"        => $changed,
        "recoveredCount" => $recoveredCount,
        "ledger"         => $ledger
    ];
}

function cleanText($str, $maxLen = 200) {
    $s = trim(strip_tags((string)$str));
    if (function_exists('mb_substr')) {
        return mb_substr($s, 0, $maxLen, 'UTF-8');
    }
    return substr($s, 0, $maxLen);
}

function getClientIpHash() {
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    return hash('sha256', 'peg_ip_salt_' . $ip);
}

function makeCreatorId($pin) {
    $clean = trim((string)$pin);
    if ($clean === '') return 'creator';
    return 'u_' . substr(hash('sha256', 'peg_pub_creator_' . $clean), 0, 12);
}

function sanitizePhoto($p, $isAdmin = false) {
    if (!is_array($p)) return $p;
    $authorPin = $p['authorPin'] ?? '';
    $p['authorId'] = !empty($p['authorId']) ? $p['authorId'] : ($authorPin !== '' ? makeCreatorId($authorPin) : 'creator');
    if (!$isAdmin) {
        unset($p['authorPin']);
    }
    return $p;
}

function isAdminLoggedIn() {
    return !empty($_SESSION['peg_admin_auth']) && $_SESSION['peg_admin_auth'] === true;
}

function requireAdmin() {
    if (!isAdminLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "authRequired" => true,
            "message" => "অ্যাডমিন অনুমোদন প্রয়োজন! দয়া করে অ্যাডমিন পিন দিয়ে লগইন করুন।"
        ]);
        exit;
    }
}

function verifyAdminPin($pin) {
    global $adminAuthFile;
    $pin = trim((string)$pin);
    if ($pin === '') return false;
    if (file_exists($adminAuthFile)) {
        $auth = readJson($adminAuthFile, []);
        return !empty($auth['hash']) && password_verify($pin, $auth['hash']);
    }
    return hash_equals(PEG_INIT_PIN_HASH, hash('sha256', 'peg_init_salt_2026_' . $pin));
}

function addNotification(&$notifs, $pin, $title, $message, $type = 'info') {
    if (!$pin) return;
    if (!isset($notifs['personal']) || !is_array($notifs['personal'])) $notifs['personal'] = [];
    if (!isset($notifs['personal'][$pin]) || !is_array($notifs['personal'][$pin])) $notifs['personal'][$pin] = [];
    $item = [
        "id"      => "nt_" . round(microtime(true) * 1000) . "_" . rand(100, 999),
        "title"   => $title,
        "message" => $message,
        "type"    => $type,
        "ts"      => round(microtime(true) * 1000)
    ];
    array_unshift($notifs['personal'][$pin], $item);
    $notifs['personal'][$pin] = array_slice($notifs['personal'][$pin], 0, 30);
}

function creditUserInMap(&$users, $pin, $addPoints, $isReferral = false) {
    if (!$pin || strpos(strtolower($pin), 'demo_') === 0) return null;
    $targetKey = null;
    if (isset($users[$pin])) {
        $targetKey = $pin;
    } else {
        foreach ($users as $k => $u) {
            if ($k === $pin || ($u['userId'] ?? '') === $pin || ($u['pin'] ?? '') === $pin) {
                $targetKey = $k;
                break;
            }
        }
    }
    if ($targetKey === null || !isset($users[$targetKey])) return null;

    $u = &$users[$targetKey];
    $basePts = isset($u['points']) ? intval($u['points']) : intval(round(floatval($u['taka'] ?? 0) / PEG_TAKA_PER_POINT));
    $u['points'] = max(0, $basePts + intval($addPoints));
    $u['taka']   = number_format($u['points'] * PEG_TAKA_PER_POINT, 2, '.', '');
    if ($isReferral) {
        $u['referralsCount'] = intval($u['referralsCount'] ?? 0) + 1;
    }
    return $u;
}

function buildUserStatsMap($photos, $followers) {
    $byPin = [];
    $byCreator = [];

    $initBucket = function($creatorId = '') {
        return [
            "photosCount"    => 0,
            "approvedCount"  => 0,
            "pendingCount"   => 0,
            "totalVotes"     => 0,
            "totalViews"     => 0,
            "totalLikes"     => 0,
            "followersCount" => 0,
            "myPhotos"       => [],
            "_creatorId"     => $creatorId
        ];
    };

    if (is_array($photos)) {
        foreach ($photos as $p) {
            $pin = trim((string)($p['authorPin'] ?? ''));
            $cid = !empty($p['authorId']) ? trim((string)$p['authorId']) : ($pin !== '' ? makeCreatorId($pin) : '');
            $votes = intval($p['votes'] ?? 0);
            $views = intval($p['views'] ?? 0);
            $likes = intval($p['likes'] ?? 0);
            $isApproved = !empty($p['approved']) || (($p['status'] ?? '') === 'approved');
            $compactPhoto = [
                "id"          => $p['id'] ?? '',
                "title"       => $p['title'] ?? 'শিরোনামহীন ছবি',
                "category"    => $p['category'] ?? '',
                "contestType" => $p['contestType'] ?? 'c24',
                "url"         => $p['url'] ?? '',
                "votes"       => $votes,
                "views"       => $views,
                "likes"       => $likes,
                "approved"    => $isApproved,
                "status"      => $isApproved ? 'approved' : 'pending',
                "date"        => $p['date'] ?? ''
            ];

            if ($pin !== '') {
                if (!isset($byPin[$pin])) $byPin[$pin] = $initBucket($cid);
                $byPin[$pin]['photosCount'] += 1;
                if ($isApproved) $byPin[$pin]['approvedCount'] += 1;
                else $byPin[$pin]['pendingCount'] += 1;
                $byPin[$pin]['totalVotes'] += $votes;
                $byPin[$pin]['totalViews'] += $views;
                $byPin[$pin]['totalLikes'] += $likes;
                if (count($byPin[$pin]['myPhotos']) < 50) {
                    $byPin[$pin]['myPhotos'][] = $compactPhoto;
                }
            }

            if ($cid !== '') {
                if (!isset($byCreator[$cid])) $byCreator[$cid] = $initBucket($cid);
                $byCreator[$cid]['photosCount'] += 1;
                if ($isApproved) $byCreator[$cid]['approvedCount'] += 1;
                else $byCreator[$cid]['pendingCount'] += 1;
                $byCreator[$cid]['totalVotes'] += $votes;
                $byCreator[$cid]['totalViews'] += $views;
                $byCreator[$cid]['totalLikes'] += $likes;
            }
        }
    }

    if (is_array($followers)) {
        foreach ($followers as $cid => $cnt) {
            $c = max(0, intval($cnt));
            if (!isset($byCreator[$cid])) $byCreator[$cid] = $initBucket($cid);
            $byCreator[$cid]['followersCount'] = $c;
        }
    }

    return ["byPin" => $byPin, "byCreator" => $byCreator];
}

function attachUserAggregatedStats($user, $pin, $statsMap, $includePhotos = false) {
    $cid = !empty($user['creatorId']) ? $user['creatorId'] : makeCreatorId($pin);
    $user['creatorId'] = $cid;
    $pStat = $statsMap['byPin'][$pin] ?? null;
    $cStat = $statsMap['byCreator'][$cid] ?? null;

    $user['photosCount']    = intval($pStat['photosCount'] ?? 0);
    $user['approvedCount']  = intval($pStat['approvedCount'] ?? 0);
    $user['pendingCount']   = intval($pStat['pendingCount'] ?? 0);
    $user['totalVotes']     = intval($pStat['totalVotes'] ?? ($cStat['totalVotes'] ?? 0));
    $user['totalViews']     = intval($pStat['totalViews'] ?? ($cStat['totalViews'] ?? 0));
    $user['totalLikes']     = intval($pStat['totalLikes'] ?? ($cStat['totalLikes'] ?? 0));
    $user['followersCount'] = intval($cStat['followersCount'] ?? 0);
    if ($includePhotos) {
        $user['myPhotos'] = $pStat['myPhotos'] ?? [];
    }
    return $user;
}

function fetchJsonUrl($url) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300 && $res) {
            return json_decode($res, true);
        }
        return null;
    }
    $ctx = stream_context_create(['http' => ['timeout' => 12]]);
    $res = @file_get_contents($url, false, $ctx);
    return $res ? json_decode($res, true) : null;
}

function saveBase64Image($imgData, $photoId, $uploadDir) {
    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/i', $imgData, $m)) {
        return null;
    }
    $raw = substr($imgData, strpos($imgData, ',') + 1);
    $bin = base64_decode($raw, true);
    if ($bin === false || strlen($bin) < 100 || strlen($bin) > 5 * 1024 * 1024) {
        return null;
    }
    $info = @getimagesizefromstring($bin);
    if ($info === false || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) {
        return null;
    }
    $ext = $info[2] === IMAGETYPE_PNG ? 'png' : ($info[2] === IMAGETYPE_WEBP ? 'webp' : 'jpg');
    $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '', $photoId);
    $fileName = $safeId . '.' . $ext;
    if (file_put_contents($uploadDir . '/' . $fileName, $bin, LOCK_EX) === false) {
        return null;
    }
    return 'uploads/' . $fileName;
}

// ডিফল্ট ছবি ইনিশিয়ালাইজেশন (ফাঁকা থাকলে)
if (!file_exists($photosFile)) {
    $defaultPhotos = [
        [
            "id" => "photo_1",
            "title" => "গ্রামের শান্ত বিকেল ও সূর্যাস্ত",
            "category" => "গ্রামের দৃশ্য",
            "authorName" => "তানভীর হাসান",
            "authorPin" => "demo_tanvir",
            "authorId" => makeCreatorId("demo_tanvir"),
            "photoType" => "FREE",
            "price" => 0,
            "views" => 342,
            "votes" => 68,
            "likes" => 25,
            "contestType" => "c24",
            "approved" => true,
            "status" => "approved",
            "url" => "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=80",
            "date" => date('c', strtotime('-4 hours'))
        ],
        [
            "id" => "photo_2",
            "title" => "নদীর বুকে পালতোলা নৌকা",
            "category" => "নদী ও নৌকা",
            "authorName" => "রাকিবুল ইসলাম",
            "authorPin" => "demo_rakib",
            "authorId" => makeCreatorId("demo_rakib"),
            "photoType" => "FREE",
            "price" => 0,
            "views" => 654,
            "votes" => 112,
            "likes" => 40,
            "contestType" => "c7",
            "approved" => true,
            "status" => "approved",
            "url" => "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=800&auto=format&fit=crop&q=80",
            "date" => date('c', strtotime('-20 hours'))
        ]
    ];
    writeJson($photosFile, $defaultPhotos);
}

$rawInput = file_get_contents('php://input');
$input    = json_decode($rawInput, true);
if (!is_array($input)) $input = [];
$action   = $_GET['action'] ?? ($input['action'] ?? '');
$ipHash   = getClientIpHash();

switch ($action) {

    // ===== ১. অ্যাডমিন অথেনটিকেশন (Session + Brute-force Limit) =====
    case 'admin_check':
        echo json_encode([
            "success" => true,
            "loggedIn" => isAdminLoggedIn(),
            "isDefaultPin" => !file_exists($adminAuthFile)
        ]);
        break;

    case 'admin_login':
        $attempts = readJson($adminAttemptsFile, []);
        $now = time();
        $rec = $attempts[$ipHash] ?? ["count" => 0, "lockedUntil" => 0];
        if (($rec['lockedUntil'] ?? 0) > $now) {
            $mins = ceil(($rec['lockedUntil'] - $now) / 60);
            http_response_code(429);
            echo json_encode(["success" => false, "message" => "অনেকবার ভুল পিন দেওয়া হয়েছে! অনুগ্রহ করে {$mins} মিনিট পর চেষ্টা করুন।"]);
            exit;
        }

        $pin = trim((string)($input['pin'] ?? ''));
        if (verifyAdminPin($pin)) {
            unset($attempts[$ipHash]);
            writeJson($adminAttemptsFile, $attempts);
            if (session_status() !== PHP_SESSION_ACTIVE) session_start();
            if (function_exists('session_regenerate_id')) @session_regenerate_id(true);
            $_SESSION['peg_admin_auth'] = true;
            session_write_close();
            echo json_encode([
                "success" => true,
                "isDefaultPin" => !file_exists($adminAuthFile)
            ]);
        } else {
            $rec['count'] = ($rec['count'] ?? 0) + 1;
            if ($rec['count'] >= 6) {
                $rec['lockedUntil'] = $now + 900; // ১৫ মিনিট লক
                $rec['count'] = 0;
            }
            $attempts[$ipHash] = $rec;
            writeJson($adminAttemptsFile, $attempts);
            http_response_code(401);
            echo json_encode(["success" => false, "message" => "ভুল অ্যাডমিন পিন! সঠিক পিন দিন।"]);
        }
        break;

    case 'admin_logout':
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['peg_admin_auth'] = false;
        session_destroy();
        echo json_encode(["success" => true]);
        break;

    case 'change_admin_pin':
        requireAdmin();
        $currPin = trim((string)($input['currentPin'] ?? ''));
        $newPin  = trim((string)($input['newPin'] ?? ''));
        if (!verifyAdminPin($currPin)) {
            echo json_encode(["success" => false, "message" => "বর্তমান পিনটি সঠিক নয়!"]);
            exit;
        }
        if (strlen($newPin) < 4 || strlen($newPin) > 32) {
            echo json_encode(["success" => false, "message" => "নতুন পিন কমপক্ষে ৪ অক্ষরের হতে হবে!"]);
            exit;
        }
        writeJson($adminAuthFile, [
            "hash" => password_hash($newPin, PASSWORD_DEFAULT),
            "updated" => date('c')
        ]);
        echo json_encode(["success" => true, "message" => "অ্যাডমিন পিন সফলভাবে পরিবর্তন হয়েছে!"]);
        break;

    // ===== ২. ভিজিটর ও সেটিংস =====
    case 'stats':
        $stats = readJson($statsFile, ["total" => 12450, "today" => 120, "lastDate" => date('Y-m-d')]);
        $today = date('Y-m-d');
        if (($stats['lastDate'] ?? '') !== $today) {
            $stats['lastDate'] = $today;
            $stats['today'] = 0;
        }
        $stats['total'] = intval($stats['total'] ?? 12450) + 1;
        $stats['today'] = intval($stats['today'] ?? 0) + 1;
        writeJson($statsFile, $stats);
        echo json_encode(["success" => true, "stats" => $stats]);
        break;

    case 'get_settings':
        $settings = readJson($settingsFile, []);
        echo json_encode([
            "success" => true,
            "auto_approve" => !empty($settings['auto_approve']),
            "upload_quota_enabled" => !empty($settings['upload_quota_enabled']),
            "upload_need_likes" => isset($settings['upload_need_likes']) ? intval($settings['upload_need_likes']) : 5,
            "upload_need_follows" => isset($settings['upload_need_follows']) ? intval($settings['upload_need_follows']) : 3,
            "max_photos_per_user" => isset($settings['max_photos_per_user']) ? max(0, intval($settings['max_photos_per_user'])) : 0
        ]);
        break;

    case 'set_auto_approve':
        requireAdmin();
        $enabled = !empty($input['enabled']);
        $settings = readJson($settingsFile, []);
        $settings['auto_approve'] = $enabled;
        writeJson($settingsFile, $settings);
        echo json_encode(["success" => true, "auto_approve" => $enabled]);
        break;

    case 'set_quota_settings':
        requireAdmin();
        $settings = readJson($settingsFile, []);
        $settings['upload_quota_enabled'] = !empty($input['enabled']);
        $settings['upload_need_likes'] = max(0, min(100, intval($input['needLikes'] ?? 5)));
        $settings['upload_need_follows'] = max(0, min(100, intval($input['needFollows'] ?? 3)));
        $settings['max_photos_per_user'] = max(0, min(1000, intval($input['maxPhotosPerUser'] ?? 0)));
        writeJson($settingsFile, $settings);
        echo json_encode(["success" => true, "settings" => $settings]);
        break;

    // ===== ৩. ছবি গ্যালারি ও আপলোড =====
    case 'get_photos':
        $photos = readPhotosSafe($photosFile);
        $isAdmin = isAdminLoggedIn() && (!empty($_GET['all']) || !empty($input['all']));
        $out = [];
        foreach ($photos as $p) {
            $approved = ($p['approved'] ?? true) !== false;
            if ($isAdmin || $approved) {
                $out[] = sanitizePhoto($p, $isAdmin);
            }
        }
        echo json_encode(["success" => true, "photos" => $out]);
        break;

    case 'upload_photo':
        $title       = cleanText($input['title'] ?? '', 120);
        $category    = cleanText($input['category'] ?? 'প্রকৃতি', 60);
        $contestType = in_array($input['contestType'] ?? '', ['c24', 'c7', 'c30'], true) ? $input['contestType'] : 'c24';
        $authorName  = cleanText($input['authorName'] ?? 'শিল্পী', 60);
        $authorPin   = cleanText($input['authorPin'] ?? '', 20);
        $photoType   = ($input['photoType'] ?? 'FREE') === 'PAID' ? 'PAID' : 'FREE';
        $price       = $photoType === 'PAID' ? max(5, min(5000, intval($input['price'] ?? 10))) : 0;
        $imgData     = (string)($input['image'] ?? '');

        if ($title === '' || $imgData === '') {
            echo json_encode(["success" => false, "message" => "ছবির শিরোনাম বা ডাটা পাওয়া যায়নি!"]);
            exit;
        }

        if ($authorPin !== '') {
            $users = readUsersSafe($usersFile);
            $author = findUserByIdentifier($users, $authorPin);
            if ($author && !empty($author['blocked'])) {
                echo json_encode(["success" => false, "message" => "🚫 আপনার অ্যাকাউন্টটি ব্লক করা আছে। ছবি আপলোড করা যাবে না।"]);
                exit;
            }
        }

        // সার্ভার থেকেই settings ও সর্বোচ্চ ছবির লিমিট যাচাই (অতিরিক্ত ফাইল সেভ হওয়া রোধ)
        $settings   = readJson($settingsFile, ["auto_approve" => false]);
        $maxPhotos  = max(0, intval($settings['max_photos_per_user'] ?? 0));
        $photos     = readPhotosSafe($photosFile);
        if ($maxPhotos > 0 && $authorPin !== '') {
            $userCurrentCount = 0;
            foreach ($photos as $p) {
                if (trim((string)($p['authorPin'] ?? '')) === $authorPin) {
                    $userCurrentCount++;
                }
            }
            if ($userCurrentCount >= $maxPhotos) {
                echo json_encode([
                    "success" => false,
                    "limitReached" => true,
                    "message" => "দুঃখিত! একজন ইউজার সর্বোচ্চ {$maxPhotos}টি ছবি আপলোড করতে পারবেন। আপনি ইতিমধ্যে {$userCurrentCount}টি ছবি আপলোড করেছেন।"
                ]);
                exit;
            }
        }

        $photoId = "photo_" . round(microtime(true) * 1000) . "_" . rand(10, 99);
        $fileUrl = saveBase64Image($imgData, $photoId, $uploadDir);
        if ($fileUrl === null) {
            echo json_encode(["success" => false, "message" => "অবৈধ বা অতিরিক্ত বড় ছবি! দয়া করে JPG/PNG/WebP ছবি দিন।"]);
            exit;
        }

        // সার্ভার থেকেই auto_approve যাচাই (ক্লায়েন্ট approved পাঠিয়ে বাইপাস করতে পারবে না)
        $isApproved = !empty($settings['auto_approve']);

        $newPhoto = [
            "id"          => $photoId,
            "title"       => $title,
            "category"    => $category,
            "contestType" => $contestType,
            "authorName"  => $authorName,
            "authorPin"   => $authorPin,
            "authorId"    => makeCreatorId($authorPin ?: $authorName),
            "photoType"   => $photoType,
            "price"       => $price,
            "url"         => $fileUrl,
            "views"       => 0,
            "votes"       => 0,
            "likes"       => 0,
            "approved"    => $isApproved,
            "status"      => $isApproved ? "approved" : "pending",
            "date"        => date('c')
        ];

        array_unshift($photos, $newPhoto);
        writeJson($photosFile, $photos);

        if ($authorPin !== '') {
            $users = readJson($usersFile, []);
            if (isset($users[$authorPin])) {
                $cnt = 0;
                foreach ($photos as $p) {
                    if (trim((string)($p['authorPin'] ?? '')) === $authorPin) $cnt++;
                }
                $users[$authorPin]['photosCount'] = $cnt;
                writeJson($usersFile, $users);
            }
        }

        sendTelegramNotification("📷 <b>নতুন ছবি জমা পড়েছে!</b>\nশিরোনাম: {$title}\nশিল্পী: {$authorName}\nক্যাটাগরি: {$category}");

        echo json_encode(["success" => true, "photo" => sanitizePhoto($newPhoto, false)]);
        break;

    case 'vote':
        $photoId  = cleanText($input['photoId'] ?? '', 64);
        $voterPin = cleanText($input['voterPin'] ?? '', 20);
        if ($photoId === '') {
            echo json_encode(["success" => false, "message" => "ছবি আইডি নেই"]);
            exit;
        }

        if ($voterPin !== '') {
            $users = readUsersSafe($usersFile);
            $voter = findUserByIdentifier($users, $voterPin);
            if ($voter && !empty($voter['blocked'])) {
                echo json_encode(["success" => false, "message" => "🚫 আপনার অ্যাকাউন্টটি ব্লক করা আছে।"]);
                exit;
            }
        }

        $votesLog = readJson($votesLogFile, []);
        if (!empty($votesLog[$photoId][$ipHash])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে এই ছবিতে ভোট দিয়েছেন!"]);
            exit;
        }

        $photos   = readPhotosSafe($photosFile);
        $found    = false;
        $newVotes = 0;

        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['votes'] = intval($p['votes'] ?? 0) + 1;
                $newVotes   = $p['votes'];
                $found      = true;

                if (!empty($p['authorPin'])) {
                    $users = readJson($usersFile, []);
                    if (creditUserInMap($users, $p['authorPin'], 2) !== null) {
                        writeJson($usersFile, $users);
                    }
                }
                break;
            }
        }
        unset($p);

        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবিটি খুঁজে পাওয়া যায়নি!"]);
            exit;
        }

        writeJson($photosFile, $photos);
        $votesLog[$photoId][$ipHash] = time();
        writeJson($votesLogFile, $votesLog);

        if ($voterPin !== '') {
            $users = readJson($usersFile, []);
            if (isset($users[$voterPin])) {
                $users[$voterPin]['likesGiven'] = intval($users[$voterPin]['likesGiven'] ?? 0) + 1;
                writeJson($usersFile, $users);
            }
        }

        echo json_encode(["success" => true, "votes" => $newVotes]);
        break;

    case 'like_photo':
        $photoId = cleanText($input['photoId'] ?? '', 64);
        $likesLog = readJson($likesLogFile, []);
        if ($photoId !== '' && !empty($likesLog[$photoId][$ipHash])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে এই ছবিতে লাইক দিয়েছেন!"]);
            exit;
        }
        $photos = readJson($photosFile, []);
        $found = false;
        $newLikes = 0;
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['likes'] = intval($p['likes'] ?? 0) + 1;
                $newLikes = $p['likes'];
                $found = true;
                break;
            }
        }
        unset($p);
        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি!"]);
            exit;
        }
        writeJson($photosFile, $photos);
        $likesLog[$photoId][$ipHash] = time();
        writeJson($likesLogFile, $likesLog);
        echo json_encode(["success" => true, "likes" => $newLikes]);
        break;

    case 'view':
        $photoId = cleanText($input['photoId'] ?? '', 64);
        $photos  = readJson($photosFile, []);
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['views'] = intval($p['views'] ?? 0) + 1;
                break;
            }
        }
        unset($p);
        writeJson($photosFile, $photos);
        echo json_encode(["success" => true]);
        break;

    case 'follow_creator':
        $creatorId = cleanText($input['creatorId'] ?? '', 64);
        $delta     = intval($input['delta'] ?? 1) >= 0 ? 1 : -1;
        if ($creatorId !== '') {
            $followers = readJson($followersFile, []);
            $followers[$creatorId] = max(0, intval($followers[$creatorId] ?? 0) + $delta);
            writeJson($followersFile, $followers);
        }
        echo json_encode(["success" => true]);
        break;

    // ===== ৪. ইউজার লগইন, রেজিস্ট্রেশন ও ইনকাম =====
    case 'login':
        $attempts = readJson($loginAttemptsFile, []);
        $now = time();
        $rec = $attempts[$ipHash] ?? ["count" => 0, "lockedUntil" => 0];
        if (($rec['lockedUntil'] ?? 0) > $now) {
            echo json_encode(["success" => false, "message" => "অনেকবার ভুল পিন দেওয়া হয়েছে! ১০ মিনিট পর চেষ্টা করুন।"]);
            exit;
        }

        $phone = cleanText($input['phone'] ?? '', 20);
        $pin   = cleanText($input['pin'] ?? '', 20);
        $users = readUsersSafe($usersFile);

        $matchedUser = findUserByCredentials($users, $phone, $pin);

        if ($matchedUser !== null) {
            if (!empty($matchedUser['blocked'])) {
                echo json_encode(["success" => false, "message" => "🚫 আপনার অ্যাকাউন্টটি অ্যাডমিন কর্তৃক সাময়িকভাবে ব্লক করা হয়েছে।"]);
                exit;
            }
            unset($attempts[$ipHash]);
            writeJson($loginAttemptsFile, $attempts);
            $photos    = readPhotosSafe($photosFile);
            $followers = readJson($followersFile, []);
            $statsMap  = buildUserStatsMap($photos, $followers);
            $uKey      = $matchedUser['pin'] ?? ($matchedUser['userId'] ?? '');
            $u         = attachUserAggregatedStats($matchedUser, $uKey, $statsMap, true);
            $settings  = readJson($settingsFile, []);
            $u['max_photos_per_user'] = max(0, intval($settings['max_photos_per_user'] ?? 0));
            echo json_encode(["success" => true, "user" => $u]);
        } else {
            $rec['count'] = ($rec['count'] ?? 0) + 1;
            if ($rec['count'] >= 20) {
                $rec['lockedUntil'] = $now + 600;
                $rec['count'] = 0;
            }
            $attempts[$ipHash] = $rec;
            writeJson($loginAttemptsFile, $attempts);
            echo json_encode(["success" => false, "message" => "ভুল মোবাইল নম্বর বা পিন! একাউন্ট না থাকলে নতুন একাউন্ট খুলুন।"]);
        }
        break;

    case 'get_user_stats':
        $attempts = readJson($loginAttemptsFile, []);
        $now = time();
        $rec = $attempts[$ipHash] ?? ["count" => 0, "lockedUntil" => 0];
        if (($rec['lockedUntil'] ?? 0) > $now) {
            echo json_encode(["success" => false, "message" => "অনেকবার ভুল চেষ্টা হয়েছে! কিছুক্ষণ পর চেষ্টা করুন।"]);
            exit;
        }
        $targetId = cleanText($input['userId'] ?? ($input['pin'] ?? ($input['id'] ?? '')), 40);
        $phone    = cleanText($input['phone'] ?? '', 20);
        $users    = readUsersSafe($usersFile);

        $user = null;
        if ($phone !== '' && !empty($input['pin'])) {
            $user = findUserByCredentials($users, $phone, $input['pin']);
        }
        if ($user === null && $targetId !== '') {
            $user = findUserByIdentifier($users, $targetId);
        }

        if ($user !== null) {
            $photos    = readPhotosSafe($photosFile);
            $followers = readJson($followersFile, []);
            $settings  = readJson($settingsFile, []);
            $statsMap  = buildUserStatsMap($photos, $followers);
            $uPin      = $user['pin'] ?? ($user['userId'] ?? '');
            $u         = attachUserAggregatedStats($user, $uPin, $statsMap, true);
            $maxP      = max(0, intval($settings['max_photos_per_user'] ?? 0));
            $u['max_photos_per_user'] = $maxP;
            echo json_encode(["success" => true, "user" => $u, "max_photos_per_user" => $maxP]);
        } else {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি"]);
        }
        break;

    case 'register':
        $name   = cleanText($input['name'] ?? '', 60);
        $phone  = cleanText($input['phone'] ?? '', 20);
        $pin    = cleanText($input['pin'] ?? '', 20);
        $rawRef = cleanText($input['ref'] ?? '', 40);

        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($pin) < 4 || strpos(strtolower($pin), 'demo_') === 0 || $name === '' || strlen($cleanPhone) < 10) {
            echo json_encode(["success" => false, "message" => "সঠিক তথ্য দিন! মোবাইল নম্বর (কমপক্ষে ১০ সংখ্যা) এবং পিন (কমপক্ষে ৪ সংখ্যা) হতে হবে।"]);
            exit;
        }

        $users = readUsersSafe($usersFile);

        // ১ সিমে ১ একাউন্ট চেক (Duplicate Mobile Prevention)
        foreach ($users as $id => $u) {
            $uPhone = preg_replace('/[^0-9]/', '', (string)($u['phone'] ?? ''));
            if ($uPhone !== '' && (strlen($uPhone) >= 10 && strlen($cleanPhone) >= 10 && substr($uPhone, -10) === substr($cleanPhone, -10))) {
                echo json_encode(["success" => false, "message" => "এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে! দয়া করে লগইন করুন।"]);
                exit;
            }
        }

        $userId = 'u_' . round(microtime(true) * 1000) . '_' . rand(10, 99);
        $newUser = [
            "id"             => $userId,
            "userId"         => $userId,
            "creatorId"      => $userId,
            "pin"            => $pin,
            "name"           => $name,
            "phone"          => $phone,
            "points"         => 20, // ওয়েলকাম বোনাস
            "taka"           => "2.00",
            "photosCount"    => 0,
            "referralsCount" => 0,
            "verified"       => false,
            "telegramBonus"  => false,
            "refCode"        => "REF" . substr($cleanPhone, -4) . rand(10, 99),
            "referredBy"     => $rawRef,
            "blocked"        => false,
            "created"        => date('c')
        ];

        // রেফারেল বোনাস প্রদান (১০ পয়েন্ট = ৳১.০০)
        if ($rawRef !== '') {
            $cleanRef = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $rawRef));
            $refCandidate = (strpos($cleanRef, 'REF') === 0) ? substr($cleanRef, 3) : $cleanRef;
            $cleanPhoneRef = preg_replace('/[^0-9]/', '', $rawRef);
            $targetRefKey = null;

            foreach ($users as $upin => $u) {
                $uPinClean   = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', (string)($u['pin'] ?? '')));
                $uRefClean   = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', (string)($u['refCode'] ?? '')));
                $uPhoneClean = preg_replace('/[^0-9]/', '', (string)($u['phone'] ?? ''));
                $uIdClean    = strtoupper($upin);

                if (
                    $uIdClean === $cleanRef ||
                    $uPinClean === $cleanRef ||
                    $uPinClean === $refCandidate ||
                    $uRefClean === $cleanRef ||
                    $uRefClean === ('REF' . $cleanRef) ||
                    ($cleanPhoneRef !== '' && strlen($cleanPhoneRef) >= 10 && $uPhoneClean !== '' && substr($uPhoneClean, -10) === substr($cleanPhoneRef, -10))
                ) {
                    $targetRefKey = $upin;
                    break;
                }
            }

            if ($targetRefKey !== null && $targetRefKey !== $userId && isset($users[$targetRefKey])) {
                $refUser = &$users[$targetRefKey];
                $newUser['referredBy'] = $refUser['refCode'] ?? ('REF' . ($refUser['pin'] ?? $targetRefKey));
                if (creditUserInMap($users, $targetRefKey, 10, true) !== null) {
                    $ledger = readJson($ledgerFile, []);
                    $ledger[$userId] = [
                        "referrerId"  => $targetRefKey,
                        "refereeName" => $name,
                        "date"        => date('c')
                    ];
                    writeJson($ledgerFile, $ledger);

                    $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
                    addNotification($notifs, $refUser['pin'] ?? $targetRefKey, "🎁 নতুন রেফারেল বোনাস!", "আপনার রেফার লিংকে \"{$name}\" যোগ দিয়েছেন! আপনার ব্যালেন্সে +৳1.00 (10 পয়েন্ট) যোগ হয়েছে।", "ok");
                    writeJson($notifsFile, $notifs);
                }
            }
        }

        $users[$userId] = $newUser;
        writeJson($usersFile, $users);
        echo json_encode(["success" => true, "user" => $newUser]);
        break;

    case 'claim_telegram':
        $pin   = cleanText($input['pin'] ?? '', 20);
        $users = readJson($usersFile, []);
        if (!isset($users[$pin])) {
            echo json_encode(["success" => false, "message" => "প্রথমে একাউন্টে লগইন করুন!"]);
            exit;
        }
        if (!empty($users[$pin]['telegramBonus'])) {
            echo json_encode(["success" => false, "message" => "আপনি ইতিমধ্যে বোনাস পেয়েছেন!"]);
            exit;
        }
        $users[$pin]['telegramBonus'] = true;
        creditUserInMap($users, $pin, 100); // +100 পয়েন্ট = +৳10.00
        writeJson($usersFile, $users);
        $u = $users[$pin];
        $u['creatorId'] = makeCreatorId($pin);
        echo json_encode(["success" => true, "message" => "অভিনন্দন! ৳10 বোনাস একাউন্টে যোগ হয়েছে!", "user" => $u]);
        break;

    case 'withdraw':
        $pin    = cleanText($input['pin'] ?? '', 20);
        $phone  = cleanText($input['phone'] ?? '', 20);
        $amount = floatval($input['amount'] ?? 0);
        $method = in_array(strtolower(trim((string)($input['method'] ?? ''))), ['bkash', 'nagad', 'rocket', 'upay'], true)
            ? strtolower(trim((string)$input['method']))
            : 'bkash';

        $users = readUsersSafe($usersFile);
        $user = findUserByIdentifier($users, $pin);
        if (!$user) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }
        if (!empty($user['blocked'])) {
            echo json_encode(["success" => false, "message" => "🚫 আপনার অ্যাকাউন্টটি ব্লক করা আছে।"]);
            exit;
        }
        if ($amount < PEG_MIN_WITHDRAW_TAKA) {
            echo json_encode(["success" => false, "message" => "সর্বনিম্ন উইথড্র ৳" . PEG_MIN_WITHDRAW_TAKA . " হতে হবে!"]);
            exit;
        }
        if (floatval($user['taka'] ?? 0) < $amount) {
            echo json_encode(["success" => false, "message" => "আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই!"]);
            exit;
        }

        $photos = readPhotosSafe($photosFile);
        $actualPhotos = 0;
        foreach ($photos as $p) {
            if (($p['authorPin'] ?? '') === $pin) $actualPhotos++;
        }
        $photoCount = $actualPhotos;
        if ($photoCount < PEG_MIN_PHOTOS_WD) {
            echo json_encode(["success" => false, "message" => "টাকা তুলতে আপনার কমপক্ষে " . PEG_MIN_PHOTOS_WD . "টি ছবি আপলোড থাকতে হবে! বর্তমানে আছে {$photoCount}টি।"]);
            exit;
        }

        $deductPts = intval(round($amount / PEG_TAKA_PER_POINT));
        creditUserInMap($users, $pin, -$deductPts);
        writeJson($usersFile, $users);

        $withdraws = readJson($withdrawsFile, []);
        $newWd = [
            "id"     => "wd_" . round(microtime(true) * 1000) . "_" . rand(10, 99),
            "pin"    => $pin,
            "name"   => $user['name'],
            "phone"  => $phone,
            "amount" => $amount,
            "method" => $method,
            "status" => "pending",
            "date"   => date('c')
        ];
        array_unshift($withdraws, $newWd);
        writeJson($withdrawsFile, $withdraws);

        sendTelegramNotification("💳 <b>নতুন উইথড্র আবেদন!</b>\nনাম: {$user['name']}\nমোবাইল: {$phone}\nপরিমাণ: <b>৳{$amount}</b> (" . strtoupper($method) . ")");

        echo json_encode(["success" => true, "message" => "উইথড্র আবেদন সফল হয়েছে! অ্যাডমিন যাচাই করে বিকাশ/নগদে টাকা পাঠাবে।"]);
        break;

    case 'get_user_withdraws':
        $pin   = cleanText($input['pin'] ?? '', 20);
        $phone = cleanText($input['phone'] ?? '', 20);
        if ($pin === '' && $phone === '') {
            echo json_encode(["success" => false, "message" => "পিন বা নম্বর প্রয়োজন"]);
            exit;
        }
        $withdraws = readJson($withdrawsFile, []);
        $cleanPhone = $phone !== '' ? preg_replace('/[^0-9]/', '', $phone) : '';
        $userWd = [];
        foreach ($withdraws as $w) {
            $wPin = trim((string)($w['pin'] ?? ''));
            $wPhone = preg_replace('/[^0-9]/', '', (string)($w['phone'] ?? ''));
            $matchPin = ($pin !== '' && $wPin === $pin);
            $matchPhone = ($cleanPhone !== '' && $wPhone !== '' && (strpos($wPhone, $cleanPhone) !== false || strpos($cleanPhone, $wPhone) !== false));
            if ($matchPin || $matchPhone) {
                $userWd[] = [
                    "id"     => $w['id'] ?? '',
                    "pin"    => $w['pin'] ?? '',
                    "name"   => $w['name'] ?? '',
                    "phone"  => $w['phone'] ?? '',
                    "amount" => floatval($w['amount'] ?? 0),
                    "method" => $w['method'] ?? 'bkash',
                    "status" => $w['status'] ?? 'pending',
                    "trxId"  => $w['trxId'] ?? '',
                    "note"   => $w['note'] ?? '',
                    "paidAt" => $w['paidAt'] ?? '',
                    "date"   => $w['date'] ?? ''
                ];
            }
        }
        echo json_encode(["success" => true, "withdraws" => $userWd]);
        break;

    case 'get_public_proofs':
        $withdraws = readJson($withdrawsFile, []);
        $proofs = [];
        foreach ($withdraws as $w) {
            if (($w['status'] ?? '') === 'paid') {
                $phone = (string)($w['phone'] ?? '');
                $masked = strlen($phone) >= 8 ? substr($phone, 0, 3) . '****' . substr($phone, -4) : '01X****XXXX';
                $proofs[] = [
                    "id"          => $w['id'] ?? '',
                    "name"        => $w['name'] ?? 'শিল্পী',
                    "phoneMasked" => $masked,
                    "amount"      => floatval($w['amount'] ?? 0),
                    "method"      => $w['method'] ?? 'bkash',
                    "trxId"       => $w['trxId'] ?? 'VERIFIED',
                    "date"        => $w['paidAt'] ?? ($w['date'] ?? '')
                ];
            }
        }
        echo json_encode(["success" => true, "proofs" => array_slice($proofs, 0, 40)]);
        break;

    // ===== ৫. পাবলিক লাইভ চ্যাট ও নোটিফিকেশন =====
    case 'get_chat':
        $chat = readJson($chatFile, []);
        $out  = [];
        foreach (array_slice($chat, -60) as $m) {
            $out[] = [
                "id"       => $m['id'] ?? '',
                "text"     => $m['text'] ?? '',
                "name"     => $m['name'] ?? 'অতিথি',
                "senderId" => $m['senderId'] ?? (!empty($m['pin']) ? makeCreatorId($m['pin']) : ''),
                "isAdmin"  => !empty($m['isAdmin']),
                "time"     => $m['time'] ?? ''
            ];
        }
        echo json_encode(["success" => true, "messages" => $out]);
        break;

    case 'send_chat':
        $text = cleanText($input['text'] ?? '', 500);
        if ($text === '') {
            echo json_encode(["success" => false, "message" => "বার্তা লিখুন"]);
            exit;
        }
        $isAdmin  = isAdminLoggedIn() && !empty($input['asAdmin']);
        $rawPin   = cleanText($input['pin'] ?? '', 20);

        if (!$isAdmin && $rawPin !== '') {
            $users = readUsersSafe($usersFile);
            $u = findUserByIdentifier($users, $rawPin);
            if ($u && !empty($u['blocked'])) {
                echo json_encode(["success" => false, "message" => "🚫 আপনার অ্যাকাউন্টটি ব্লক করা আছে।"]);
                exit;
            }
        }
        $name     = $isAdmin ? "অ্যাডমিন (Admin)" : cleanText($input['name'] ?? 'অতিথি', 40);
        $senderId = $isAdmin ? "admin" : ($rawPin !== '' ? makeCreatorId($rawPin) : cleanText($input['guestId'] ?? $ipHash, 32));

        $newMsg = [
            "id"       => "msg_" . round(microtime(true) * 1000),
            "text"     => $text,
            "name"     => $name,
            "senderId" => $senderId,
            "isAdmin"  => $isAdmin,
            "time"     => date('c')
        ];
        $chat = readJson($chatFile, []);
        $chat[] = $newMsg;
        if (count($chat) > 60) $chat = array_slice($chat, -60);
        writeJson($chatFile, $chat);
        echo json_encode(["success" => true, "message" => $newMsg]);
        break;

    case 'get_notifications':
        $pin    = cleanText($input['pin'] ?? '', 20);
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        $personal  = ($pin !== '' && !empty($notifs['personal'][$pin])) ? $notifs['personal'][$pin] : [];
        $broadcast = $notifs['broadcast'] ?? [];
        $all = array_merge($personal, $broadcast);
        usort($all, function($a, $b) {
            return ($b['ts'] ?? 0) <=> ($a['ts'] ?? 0);
        });
        echo json_encode(["success" => true, "notifications" => array_slice($all, 0, 35)]);
        break;

    // ===== ৬. কেবল অ্যাডমিন অ্যাকশনসমূহ (requireAdmin() বাধ্যতামূলক) =====
    case 'get_withdraws':
        requireAdmin();
        echo json_encode(["success" => true, "withdraws" => readJson($withdrawsFile, [])]);
        break;

    case 'update_withdraw':
        requireAdmin();
        $id        = cleanText($input['id'] ?? '', 64);
        $newStatus = ($input['status'] ?? '') === 'rejected' ? 'rejected' : 'paid';
        $trxId     = cleanText($input['trxId'] ?? '', 100);
        $note      = cleanText($input['note'] ?? '', 255);
        $withdraws = readJson($withdrawsFile, []);
        $target    = null;
        foreach ($withdraws as &$w) {
            if (($w['id'] ?? '') === $id) {
                $w['status'] = $newStatus;
                if ($newStatus === 'paid') {
                    $w['trxId']  = $trxId !== '' ? $trxId : ($w['trxId'] ?? ('TRX' . strtoupper(substr(md5(uniqid()), 0, 10))));
                    $w['paidAt'] = date('c');
                }
                if ($note !== '') {
                    $w['note'] = $note;
                }
                $target = $w;
                break;
            }
        }
        unset($w);
        writeJson($withdrawsFile, $withdraws);
        if ($target && !empty($target['pin'])) {
            if ($newStatus === 'rejected') {
                $refundPts = intval(round(floatval($target['amount'] ?? 0) / PEG_TAKA_PER_POINT));
                if ($refundPts > 0) {
                    $users = readUsersSafe($usersFile);
                    creditUserInMap($users, $target['pin'], $refundPts);
                    writeJson($usersFile, $users);
                }
            }

            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            $msg = $newStatus === 'paid'
                ? "আপনার ৳{$target['amount']} উইথড্র আবেদন ({$target['method']}) সফলভাবে পরিশোধ করা হয়েছে। TrxID: " . ($target['trxId'] ?? 'VERIFIED') . "। ভাউচার দেখুন ও শেয়ার করুন।"
                : "দুঃখিত, আপনার ৳{$target['amount']} উইথড্র আবেদনটি অ্যাডমিন বাতিল করেছেন এবং পয়েন্ট ফেরত দেওয়া হয়েছে।";

            addNotification(
                $notifs,
                $target['pin'],
                $newStatus === 'paid' ? "💸 পেমেন্ট সম্পন্ন হয়েছে!" : "⚠️ উইথড্র আবেদন বাতিল হয়েছে",
                $msg,
                $newStatus === 'paid' ? 'ok' : 'bad'
            );
            writeJson($notifsFile, $notifs);

            if ($newStatus === 'paid') {
                $tTrx = $target['trxId'] ?? 'VERIFIED';
                sendTelegramNotification("💸 <b>পেমেন্ট সফলভাবে পরিশোধিত!</b>\nপ্রাপক: {$target['name']}\nপরিমাণ: <b>৳{$target['amount']}</b> (" . strtoupper($target['method']) . ")\nমোবাইল: {$target['phone']}\nTrxID: <code>{$tTrx}</code>\n✅ পেমেন্ট প্রুফ ভেরিফাইড!");
            }
        }
        echo json_encode(["success" => true, "withdraw" => $target]);
        break;

    case 'approve_photo':
        requireAdmin();
        $photoId = cleanText($input['id'] ?? '', 64);
        $photos  = readPhotosSafe($photosFile);
        $found   = null;
        foreach ($photos as &$p) {
            if (($p['id'] ?? '') === $photoId) {
                $p['approved'] = true;
                $p['status']   = 'approved';
                $found = $p;
                break;
            }
        }
        unset($p);
        if (!$found) {
            echo json_encode(["success" => false, "message" => "ছবি পাওয়া যায়নি"]);
            exit;
        }
        writeJson($photosFile, $photos);
        if (!empty($found['authorPin'])) {
            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            addNotification($notifs, $found['authorPin'], "ছবি অনুমোদিত হয়েছে! 🎉", "অভিনন্দন! আপনার ছবি \"{$found['title']}\" অ্যাডমিন কর্তৃক অনুমোদিত হয়েছে এবং পাবলিক ফিডে লাইভ হয়েছে।", "ok");
            writeJson($notifsFile, $notifs);
        }
        echo json_encode(["success" => true, "photo" => sanitizePhoto($found, true)]);
        break;

    case 'reject_photo':
        requireAdmin();
        $photoId = cleanText($input['id'] ?? '', 64);
        $reason  = cleanText($input['reason'] ?? 'নীতিমালা পরিপন্থী বা অস্পষ্ট ছবি', 200);
        $photos  = readPhotosSafe($photosFile);
        $updated = [];
        $target  = null;
        foreach ($photos as $p) {
            if (($p['id'] ?? '') === $photoId) {
                $target = $p;
                if (!empty($p['url']) && strpos($p['url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $p['url'])) {
                    @unlink(__DIR__ . '/' . $p['url']);
                }
            } else {
                $updated[] = $p;
            }
        }
        writeJson($photosFile, $updated);
        if ($target && !empty($target['authorPin'])) {
            $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
            addNotification($notifs, $target['authorPin'], "ছবি অনুমোদন হয়নি", "দুঃখিত! আপনার ছবি \"{$target['title']}\" বাতিল করা হয়েছে। কারণ: {$reason}", "bad");
            writeJson($notifsFile, $notifs);
        }
        echo json_encode(["success" => true]);
        break;

    case 'delete_photo':
        requireAdmin();
        $id      = cleanText($input['id'] ?? '', 64);
        $photos  = readPhotosSafe($photosFile);
        $updated = [];
        foreach ($photos as $p) {
            if (($p['id'] ?? '') === $id) {
                if (!empty($p['url']) && strpos($p['url'], 'uploads/') === 0 && file_exists(__DIR__ . '/' . $p['url'])) {
                    @unlink(__DIR__ . '/' . $p['url']);
                }
            } else {
                $updated[] = $p;
            }
        }
        writeJson($photosFile, $updated);
        echo json_encode(["success" => true]);
        break;

    case 'get_all_users':
        requireAdmin();
        $users     = readUsersSafe($usersFile);
        $notifs    = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        $recResult = syncMissedReferralsSafe($users, $notifs, $ledgerFile);
        if ($recResult['changed']) {
            writeJson($usersFile, $users);
            writeJson($notifsFile, $notifs);
        }

        $photos    = readPhotosSafe($photosFile);
        $followers = readJson($followersFile, []);
        $statsMap  = buildUserStatsMap($photos, $followers);
        $list      = [];
        foreach ($users as $uKey => $uData) {
            $pinKey = (string)($uData['pin'] ?? $uKey);
            $item = attachUserAggregatedStats($uData, $pinKey, $statsMap, false);
            $item['userId'] = $uData['userId'] ?? ($uData['id'] ?? $uKey);
            $item['blocked'] = !empty($uData['blocked']);
            $item['referredBy'] = $uData['referredBy'] ?? '';
            $list[] = $item;
        }
        usort($list, function($a, $b) {
            return floatval($b['taka'] ?? 0) <=> floatval($a['taka'] ?? 0);
        });
        echo json_encode(["success" => true, "users" => $list, "recovered" => $recResult['recoveredCount']]);
        break;

    case 'sync_missed_referrals':
        requireAdmin();
        $users     = readUsersSafe($usersFile);
        $notifs    = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        $recResult = syncMissedReferralsSafe($users, $notifs, $ledgerFile);
        if ($recResult['changed']) {
            writeJson($usersFile, $users);
            writeJson($notifsFile, $notifs);
        }
        echo json_encode([
            "success"   => true,
            "recovered" => $recResult['recoveredCount'],
            "message"   => "মোট {$recResult['recoveredCount']} জন রেফারারের মিসড পয়েন্ট সফলভাবে রিকভার করা হয়েছে!"
        ]);
        break;

    case 'toggle_block_user':
        requireAdmin();
        $targetId = cleanText($input['userId'] ?? ($input['pin'] ?? ''), 64);
        $users    = readUsersSafe($usersFile);
        $targetKey = null;
        foreach ($users as $k => $u) {
            if ($k === $targetId || ($u['userId'] ?? '') === $targetId || ($u['pin'] ?? '') === $targetId || ($u['phone'] ?? '') === $targetId) {
                $targetKey = $k;
                break;
            }
        }
        if ($targetKey === null) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }
        $isCurrentlyBlocked = !empty($users[$targetKey]['blocked']);
        $users[$targetKey]['blocked'] = !$isCurrentlyBlocked;
        writeJson($usersFile, $users);
        $statusText = $users[$targetKey]['blocked'] ? 'ব্লক' : 'আনব্লক';
        echo json_encode([
            "success" => true,
            "blocked" => $users[$targetKey]['blocked'],
            "message" => "ইউজারকে সফলভাবে {$statusText} করা হয়েছে!"
        ]);
        break;

    case 'delete_user':
        requireAdmin();
        $targetId = cleanText($input['userId'] ?? ($input['pin'] ?? ''), 64);
        $users    = readUsersSafe($usersFile);
        $targetKey = null;
        foreach ($users as $k => $u) {
            if ($k === $targetId || ($u['userId'] ?? '') === $targetId || ($u['pin'] ?? '') === $targetId || ($u['phone'] ?? '') === $targetId) {
                $targetKey = $k;
                break;
            }
        }
        if ($targetKey === null) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }
        $delName = $users[$targetKey]['name'] ?? 'ইউজার';
        unset($users[$targetKey]);
        writeJson($usersFile, $users);
        echo json_encode([
            "success" => true,
            "message" => "\"{$delName}\"-এর অ্যাকাউন্ট স্থায়ীভাবে মুছে ফেলা হয়েছে!"
        ]);
        break;

    case 'adjust_user_balance':
        requireAdmin();
        $pin       = cleanText($input['pin'] ?? '', 20);
        $deltaTaka = floatval($input['deltaTaka'] ?? 0);
        $note      = cleanText($input['note'] ?? '', 160);
        $addPoints = intval(round($deltaTaka / PEG_TAKA_PER_POINT));
        if ($pin === '' || $addPoints === 0) {
            echo json_encode(["success" => false, "message" => "সঠিক পরিমাণ দিন!"]);
            exit;
        }
        $users = readJson($usersFile, []);
        $updated = creditUserInMap($users, $pin, $addPoints);
        if ($updated === null) {
            echo json_encode(["success" => false, "message" => "ইউজার পাওয়া যায়নি!"]);
            exit;
        }
        writeJson($usersFile, $users);

        $amtText    = number_format(abs($deltaTaka), 2, '.', '');
        $isPositive = $deltaTaka >= 0;
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        addNotification(
            $notifs,
            $pin,
            $isPositive ? "🏆 অ্যাডমিন রিওয়ার্ড প্রাপ্তি!" : "💳 ব্যালেন্স সমন্বয়",
            $isPositive
                ? "অভিনন্দন! অ্যাডমিন আপনার অ্যাকাউন্টে +৳{$amtText} যোগ করেছেন।" . ($note ? " ({$note})" : "")
                : "অ্যাডমিন আপনার ব্যালেন্স থেকে ৳{$amtText} সমন্বয় করেছেন।" . ($note ? " ({$note})" : ""),
            $isPositive ? "ok" : "info"
        );
        writeJson($notifsFile, $notifs);

        echo json_encode(["success" => true, "user" => $updated]);
        break;

    case 'send_broadcast':
        requireAdmin();
        $title = cleanText($input['title'] ?? '📢 সাইট নোটিশ', 100);
        $msg   = cleanText($input['message'] ?? '', 500);
        if ($msg === '') {
            echo json_encode(["success" => false, "message" => "বিস্তারিত নোটিশ লিখুন"]);
            exit;
        }
        $notifs = readJson($notifsFile, ["personal" => [], "broadcast" => []]);
        if (!isset($notifs['broadcast']) || !is_array($notifs['broadcast'])) $notifs['broadcast'] = [];
        $obj = [
            "id"      => "bc_" . round(microtime(true) * 1000),
            "title"   => $title,
            "message" => $msg,
            "type"    => "broadcast",
            "ts"      => round(microtime(true) * 1000)
        ];
        array_unshift($notifs['broadcast'], $obj);
        $notifs['broadcast'] = array_slice($notifs['broadcast'], 0, 30);
        writeJson($notifsFile, $notifs);
        echo json_encode(["success" => true, "notice" => $obj]);
        break;

    case 'delete_chat':
        requireAdmin();
        $id = cleanText($input['id'] ?? '', 64);
        $chat = readJson($chatFile, []);
        $chat = array_values(array_filter($chat, function($m) use ($id) {
            return ($m['id'] ?? '') !== $id;
        }));
        writeJson($chatFile, $chat);
        echo json_encode(["success" => true]);
        break;

    case 'clear_chat':
        requireAdmin();
        writeJson($chatFile, []);
        echo json_encode(["success" => true]);
        break;

    // এককালীন পুরনো Firebase ডাটা নিরাপদে Hostinger সার্ভারে ইমপোর্ট (Firebase বন্ধ করার আগে)
    case 'import_firebase':
        requireAdmin();
        $fbUrl = rtrim(trim((string)($input['firebaseUrl'] ?? '')), '/');
        if (!preg_match('#^https://[a-zA-Z0-9-]+\.firebaseio\.com$#', $fbUrl)) {
            echo json_encode(["success" => false, "message" => "সঠিক Firebase Database URL দিন (যেমন: https://your-app.firebaseio.com)"]);
            exit;
        }

        $imported = ["users" => 0, "photos" => 0, "withdraws" => 0];

        $fbUsers = fetchJsonUrl($fbUrl . '/users.json');
        if (is_array($fbUsers)) {
            $users = readJson($usersFile, []);
            foreach ($fbUsers as $k => $u) {
                if (!is_array($u) || empty($u['name'])) continue;
                $uPin = (string)($u['pin'] ?? $k);
                if (!isset($users[$uPin])) {
                    $u['pin'] = $uPin;
                    $u['creatorId'] = makeCreatorId($uPin);
                    $users[$uPin] = $u;
                    $imported['users']++;
                }
            }
            writeJson($usersFile, $users);
        }

        $fbPhotos = fetchJsonUrl($fbUrl . '/photos.json');
        if (is_array($fbPhotos)) {
            $photos = readJson($photosFile, []);
            $existingIds = [];
            foreach ($photos as $ep) $existingIds[$ep['id'] ?? ''] = true;

            foreach ($fbPhotos as $k => $p) {
                if (!is_array($p) || empty($p['title'])) continue;
                $pid = (string)($p['id'] ?? $k);
                if (isset($existingIds[$pid])) continue;
                $p['id'] = $pid;
                if (!empty($p['url']) && strpos($p['url'], 'data:image/') === 0) {
                    $savedUrl = saveBase64Image($p['url'], $pid, $uploadDir);
                    if ($savedUrl !== null) $p['url'] = $savedUrl;
                }
                if (!empty($p['authorPin'])) $p['authorId'] = makeCreatorId($p['authorPin']);
                $photos[] = $p;
                $existingIds[$pid] = true;
                $imported['photos']++;
            }
            writeJson($photosFile, $photos);
        }

        $fbWd = fetchJsonUrl($fbUrl . '/withdraws.json');
        if (is_array($fbWd)) {
            $withdraws = readJson($withdrawsFile, []);
            $existingW = [];
            foreach ($withdraws as $ew) $existingW[$ew['id'] ?? ''] = true;
            foreach ($fbWd as $k => $w) {
                if (!is_array($w)) continue;
                $wid = (string)($w['id'] ?? $k);
                if (isset($existingW[$wid])) continue;
                $w['id'] = $wid;
                $withdraws[] = $w;
                $imported['withdraws']++;
            }
            writeJson($withdrawsFile, $withdraws);
        }

        $fbStats = fetchJsonUrl($fbUrl . '/stats.json');
        if (is_array($fbStats) && !empty($fbStats['total'])) {
            $stats = readJson($statsFile, ["total" => 0, "today" => 0, "lastDate" => date('Y-m-d')]);
            if (intval($fbStats['total']) > intval($stats['total'] ?? 0)) {
                writeJson($statsFile, $fbStats);
            }
        }

        $fbSettings = fetchJsonUrl($fbUrl . '/settings.json');
        if (is_array($fbSettings) && array_key_exists('auto_approve', $fbSettings)) {
            $settings = readJson($settingsFile, []);
            $settings['auto_approve'] = !empty($fbSettings['auto_approve']);
            writeJson($settingsFile, $settings);
        }

        echo json_encode([
            "success"  => true,
            "imported" => $imported,
            "message"  => "ইমপোর্ট সম্পন্ন! ইউজার: {$imported['users']}টি, ছবি: {$imported['photos']}টি, উইথড্র: {$imported['withdraws']}টি Hostinger সার্ভারে সেভ হয়েছে।"
        ]);
        break;

    default:
        echo json_encode(["success" => true, "status" => "Photo Earn Secure API is running"]);
        break;
}
