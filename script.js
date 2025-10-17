        import * as THREE from 'three';
        import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

        const CONFIG = {
            gridSize: 60,
            blockSize: 1,
            playerHeight: 1.7,
            moveSpeed: 24,
            sprintSpeed: 40,
            jumpForce: 12,
            gravity: 25,
            mobSpawnDistance: 20,
            mobSpawnInterval: 2,
            healthRegenRate: 5,
            enemyDamage: 2,
            enemyAttackRange: 3,
            enemyAttackSpeed: 2,
        };

        const WEAPONS = {
            pistol: { name: 'Pistol', icon: 'fa-gun', damage: 20, headshotMultiplier: 3, range: 50, fireRate: 100, magSize: 12, reserveAmmo: 96, reloadTime: 1500, hasScope: false, color: '#8B7355', isFullAuto: true },
            ar: { name: 'AR-15', icon: 'fa-gun', damage: 20, headshotMultiplier: 2.5, range: 100, fireRate: 60, magSize: 30, reserveAmmo: 120, reloadTime: 2000, hasScope: false, color: '#2F4F4F', isFullAuto: true },
            smg: { name: 'SMG', icon: 'fa-gun', damage: 12, headshotMultiplier: 2, range: 60, fireRate: 40, magSize: 30, reserveAmmo: 150, reloadTime: 1800, hasScope: false, color: '#FF6347', isFullAuto: true },
            shotgun: { name: 'Shotgun', icon: 'fa-gun', damage: 15, headshotMultiplier: 2, range: 30, fireRate: 200, magSize: 10, reserveAmmo: 40, reloadTime: 2500, hasScope: false, pellets: 8, spread: 0.12, color: '#8B4513', isFullAuto: true },
            sniper: { name: 'Sniper', icon: 'fa-crosshairs', damage: 999, headshotMultiplier: 1, range: 300, fireRate: 400, magSize: 5, reserveAmmo: 20, reloadTime: 3000, hasScope: true, scopeZoom: 6, oneShot: true, color: '#000080', isFullAuto: false },
            axe: { name: 'Battle Axe', icon: 'fa-axe', damage: 150, headshotMultiplier: 3, range: 3, throwRange: 50, throwSpeed: 25, fireRate: 800, isMelee: true, isThrowable: true, color: '#8B0000' },
            grenade: { name: 'Grenade', icon: 'fa-bomb', damage: 80, range: 50, throwForce: 20, explosionRadius: 10, count: 99999, color: '#228B22' }
        };

        class BloodPool {
            constructor(position, game, size = 1) {
                this.game = game;
                this.position = position.clone();
                this.size = size;
                this.createPool();
            }

            createPool() {
                const geometry = new THREE.CircleGeometry(this.size, 32);
                const material = new THREE.MeshBasicMaterial({
                    color: 0x8B0000,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.rotation.x = -Math.PI / 2;
                this.mesh.position.copy(this.position);
                this.mesh.position.y = this.game.getTerrainHeight(this.position.x, this.position.z) + 0.02;
                
                this.game.scene.add(this.mesh);
                this.game.bloodPoolCount++;
                document.getElementById('blood-pool-count').textContent = this.game.bloodPoolCount;
                
                let growth = 0;
                const growBlood = () => {
                    growth += 0.01;
                    const scale = 1 + growth;
                    this.mesh.scale.set(scale, scale, 1);
                    
                    if (growth < 2) {
                        requestAnimationFrame(growBlood);
                    }
                };
                growBlood();
            }
        }

        class FlowingBlood {
            constructor(position, game, isHeadshot = false) {
                this.game = game;
                this.createFlowingBlood(position, isHeadshot);
            }

            createFlowingBlood(position, isHeadshot) {
                const particleCount = isHeadshot ? 300 : 150;
                const geometry = new THREE.BufferGeometry();
                const positions = [];
                const colors = [];
                const velocities = [];

                for (let i = 0; i < particleCount; i++) {
                    const spread = isHeadshot ? 5 : 3;
                    positions.push(
                        position.x + (Math.random() - 0.5) * 0.5,
                        position.y + Math.random() * 1.5,
                        position.z + (Math.random() - 0.5) * 0.5
                    );
                    
                    const bloodShade = Math.random() * 0.3;
                    colors.push(0.7 + bloodShade, 0, 0);
                    
                    velocities.push(
                        (Math.random() - 0.5) * spread,
                        Math.random() * spread + 2,
                        (Math.random() - 0.5) * spread
                    );
                }

                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

                const material = new THREE.PointsMaterial({
                    size: isHeadshot ? 0.35 : 0.2,
                    vertexColors: true,
                    transparent: true,
                    opacity: 1
                });

                this.particleSystem = new THREE.Points(geometry, material);
                this.game.scene.add(this.particleSystem);
                this.velocities = velocities;
                this.life = 2.0;
                this.age = 0;
                this.groundHits = new Set();
            }

            update(delta) {
                this.age += delta;
                const positions = this.particleSystem.geometry.attributes.position.array;

                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += this.velocities[i] * delta;
                    positions[i + 1] += this.velocities[i + 1] * delta;
                    positions[i + 2] += this.velocities[i + 2] * delta;
                    
                    this.velocities[i + 1] -= 15 * delta;
                    this.velocities[i] *= 0.97;
                    this.velocities[i + 2] *= 0.97;
                    
                    const terrainHeight = this.game.getTerrainHeight(positions[i], positions[i + 2]);
                    if (positions[i + 1] <= terrainHeight + 0.1 && !this.groundHits.has(i)) {
                        this.groundHits.add(i);
                        
                        if (Math.random() > 0.7) {
                            const poolPos = new THREE.Vector3(positions[i], terrainHeight, positions[i + 2]);
                            new BloodPool(poolPos, this.game, 0.3 + Math.random() * 0.3);
                        }
                        
                        this.velocities[i] = 0;
                        this.velocities[i + 1] = 0;
                        this.velocities[i + 2] = 0;
                        positions[i + 1] = terrainHeight + 0.02;
                    }
                }

                this.particleSystem.geometry.attributes.position.needsUpdate = true;
                this.life -= delta * 0.3;
                this.particleSystem.material.opacity = Math.max(0, this.life);

                if (this.life <= 0 || this.age > 6) {
                    this.remove();
                    return true;
                }
                return false;
            }

            remove() {
                this.game.scene.remove(this.particleSystem);
                this.particleSystem.geometry.dispose();
                this.particleSystem.material.dispose();
            }
        }

        class ThrownAxe {
            constructor(position, direction, game) {
                this.game = game;
                this.position = position.clone();
                this.velocity = direction.multiplyScalar(WEAPONS.axe.throwSpeed);
                this.rotation = 0;
                this.hasHit = false;
                this.createMesh();
            }

            createMesh() {
                this.mesh = new THREE.Group();
                
                const handleGeometry = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 8);
                const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const handle = new THREE.Mesh(handleGeometry, handleMaterial);
                this.mesh.add(handle);
                
                const bladeGeometry = new THREE.BoxGeometry(0.6, 0.5, 0.08);
                const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
                const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade.position.y = 0.6;
                this.mesh.add(blade);
                
                const edgeGeometry = new THREE.BoxGeometry(0.65, 0.15, 0.02);
                const edgeMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
                const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
                edge.position.set(0, 0.75, 0);
                this.mesh.add(edge);
                
                this.mesh.position.copy(this.position);
                this.mesh.scale.set(0.8, 0.8, 0.8);
                this.game.scene.add(this.mesh);
            }

            update(delta) {
                if (this.hasHit) return true;

                this.velocity.y -= CONFIG.gravity * delta * 0.5;
                this.position.add(this.velocity.clone().multiplyScalar(delta));
                this.mesh.position.copy(this.position);
                
                this.rotation += delta * 15;
                this.mesh.rotation.x = this.rotation;
                
                const mobMeshes = this.game.mobs.map(mob => mob.mesh);
                const raycaster = new THREE.Raycaster(this.position, this.velocity.clone().normalize(), 0, 0.5);
                const intersects = raycaster.intersectObjects(mobMeshes, true);
                
                if (intersects.length > 0) {
                    const hitMesh = intersects[0].object;
                    const hitPoint = intersects[0].point;
                    const isHeadshot = hitMesh.userData.isHead;
                    const mob = this.game.mobs.find(m => m.mesh === hitMesh.parent || m.mesh.children.includes(hitMesh));
                    if (mob) {
                        mob.takeDamage(WEAPONS.axe.damage, hitPoint, isHeadshot);
                        if (isHeadshot) {
                            this.game.showKillNotification('💀 AXE HEADSHOT! 💀');
                        }
                        this.hasHit = true;
                        this.remove();
                        return true;
                    }
                }
                
                const terrainHeight = this.game.getTerrainHeight(this.position.x, this.position.z);
                if (this.position.y <= terrainHeight + 0.2) {
                    this.remove();
                    return true;
                }
                
                return false;
            }

            remove() {
                this.game.scene.remove(this.mesh);
                this.mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        }

        class Grenade {
            constructor(position, direction, game) {
                this.game = game;
                this.position = position.clone();
                this.velocity = direction.multiplyScalar(WEAPONS.grenade.throwForce);
                this.createMesh();
                this.exploded = false;
            }

            createMesh() {
                const geometry = new THREE.SphereGeometry(0.2, 8, 8);
                const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
                this.mesh = new THREE.Mesh(geometry, material);
                this.mesh.position.copy(this.position);
                this.game.scene.add(this.mesh);
            }

            update(delta) {
                if (this.exploded) return true;

                this.velocity.y -= CONFIG.gravity * delta;
                this.position.add(this.velocity.clone().multiplyScalar(delta));
                this.mesh.position.copy(this.position);
                this.mesh.rotation.x += delta * 10;

                const terrainHeight = this.game.getTerrainHeight(this.position.x, this.position.z);
                if (this.position.y <= terrainHeight + 0.2) {
                    this.explode();
                    return true;
                }

                return false;
            }

            explode() {
                this.exploded = true;

                const particleCount = 200;
                const geometry = new THREE.BufferGeometry();
                const positions = [];
                const colors = [];

                for (let i = 0; i < particleCount; i++) {
                    positions.push(
                        this.position.x + (Math.random() - 0.5) * 4,
                        this.position.y + (Math.random() - 0.5) * 4,
                        this.position.z + (Math.random() - 0.5) * 4
                    );
                    colors.push(1, Math.random() * 0.5, 0);
                }

                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

                const material = new THREE.PointsMaterial({
                    size: 0.5,
                    vertexColors: true,
                    transparent: true
                });
                const particles = new THREE.Points(geometry, material);
                this.game.scene.add(particles);

                let opacity = 1;
                const animate = () => {
                    opacity -= 0.015;
                    material.opacity = opacity;
                    if (opacity <= 0) {
                        this.game.scene.remove(particles);
                        geometry.dispose();
                        material.dispose();
                    } else {
                        requestAnimationFrame(animate);
                    }
                };
                animate();

                const explosionRadius = WEAPONS.grenade.explosionRadius;
                this.game.mobs.forEach(mob => {
                    const distance = mob.position.distanceTo(this.position);
                    if (distance < explosionRadius) {
                        const damage = WEAPONS.grenade.damage * (1 - distance / explosionRadius);
                        mob.takeDamage(damage, this.position, false);
                    }
                });

                this.remove();
            }

            remove() {
                this.game.scene.remove(this.mesh);
                this.mesh.geometry.dispose();
                this.mesh.material.dispose();
            }
        }

        class Mob {
            constructor(type, position, game) {
                this.game = game;
                this.health = 100;
                this.maxHealth = 100;
                this.position = position.clone();
                this.velocity = new THREE.Vector3();
                this.animTime = Math.random() * 10;
                this.rotation = 0;
                this.targetRotation = 0;
                this.isDying = false;
                this.attackCooldown = 0;

                this.createMesh();
            }

            createMesh() {
                this.mesh = new THREE.Group();

                const bodyGeometry = new THREE.BoxGeometry(0.5, 1.0, 0.3);
                const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F2F });
                this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
                this.body.position.y = 0.5;
                this.body.castShadow = true;
                this.mesh.add(this.body);

                const headSize = 0.6;
                const headGeometry = new THREE.BoxGeometry(headSize, headSize, headSize);
                const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDDAA });
                this.head = new THREE.Mesh(headGeometry, headMaterial);
                this.head.position.y = 1.3;
                this.head.userData.isHead = true;
                this.mesh.add(this.head);

                const helmetGeometry = new THREE.BoxGeometry(headSize * 1.1, headSize * 0.5, headSize * 1.1);
                const helmetMaterial = new THREE.MeshLambertMaterial({ color: 0x4B5320 });
                const helmet = new THREE.Mesh(helmetGeometry, helmetMaterial);
                helmet.position.y = 1.55;
                this.mesh.add(helmet);

                const eyeGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

                this.leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
                this.leftEye.position.set(-0.15, 1.35, 0.3);
                this.mesh.add(this.leftEye);

                this.rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
                this.rightEye.position.set(0.15, 1.35, 0.3);
                this.mesh.add(this.rightEye);

                const armGeometry = new THREE.BoxGeometry(0.15, 0.8, 0.15);
                const armMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F2F });
                this.leftArm = new THREE.Mesh(armGeometry, armMaterial);
                this.leftArm.position.set(-0.35, 0.6, 0);
                this.mesh.add(this.leftArm);

                this.rightArm = new THREE.Mesh(armGeometry, armMaterial);
                this.rightArm.position.set(0.35, 0.6, 0);
                this.mesh.add(this.rightArm);

                const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.4);
                const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
                const gun = new THREE.Mesh(gunGeometry, gunMaterial);
                gun.position.set(0.35, 0.3, 0.3);
                this.mesh.add(gun);

                const legGeometry = new THREE.BoxGeometry(0.17, 0.8, 0.17);
                const legMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F2F });
                this.leftLeg = new THREE.Mesh(legGeometry, legMaterial);
                this.leftLeg.position.set(-0.12, -0.4, 0);
                this.mesh.add(this.leftLeg);

                this.rightLeg = new THREE.Mesh(legGeometry, legMaterial);
                this.rightLeg.position.set(0.12, -0.4, 0);
                this.mesh.add(this.rightLeg);

                this.mesh.position.copy(this.position);
            }

            update(delta) {
                if (this.isDying) return;

                const player = this.game.controls.getObject();
                const distanceToPlayer = this.position.distanceTo(player.position);

                const detectionRange = this.game.isStealthMode ? this.game.stealthDetectionRange : 30;
                const canSeePlayer = distanceToPlayer < detectionRange;

                if (canSeePlayer) {
                    const direction = new THREE.Vector3()
                        .subVectors(player.position, this.position)
                        .normalize();

                    
                    const speedMultiplier = this.game.isStealthMode ? 0.7 : 1.5;
                    this.velocity.x = direction.x * speedMultiplier * delta;
                    this.velocity.z = direction.z * speedMultiplier * delta;
                    this.targetRotation = Math.atan2(direction.x, direction.z);

                    if (distanceToPlayer < CONFIG.enemyAttackRange && this.attackCooldown <= 0) {
                        this.attackPlayer();
                        this.attackCooldown = CONFIG.enemyAttackSpeed;
                    }
                } else {
                    if (Math.random() < 0.01) {
                        const angle = Math.random() * Math.PI * 2;
                        this.velocity.x = Math.sin(angle) * 1.5 * delta;
                        this.velocity.z = Math.cos(angle) * 1.5 * delta;
                        this.targetRotation = angle;
                    }
                }

                if (this.attackCooldown > 0) {
                    this.attackCooldown -= delta;
                }

                
                const oldPos = this.position.clone();
                
                this.position.x += this.velocity.x;
                this.position.z += this.velocity.z;
                
                
                const mobRadius = 0.3;
                const gridX = Math.floor((this.position.x + CONFIG.gridSize/2) / CONFIG.blockSize);
                const gridZ = Math.floor((this.position.z + CONFIG.gridSize/2) / CONFIG.blockSize);
                
                let collision = false;
                
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const checkX = gridX + dx;
                        const checkZ = gridZ + dz;
                        
                        
                        for (let y = Math.floor(this.position.y / CONFIG.blockSize); 
                             y <= Math.ceil((this.position.y + 1.8) / CONFIG.blockSize); y++) {
                            const blockKey = `${checkX},${y},${checkZ}`;
                            const block = this.game.blocks.get(blockKey);
                            
                            if (block) {
                                const blockPos = new THREE.Vector3(
                                    checkX * CONFIG.blockSize - CONFIG.gridSize/2,
                                    y * CONFIG.blockSize,
                                    checkZ * CONFIG.blockSize - CONFIG.gridSize/2
                                );
                                
                                
                                if (Math.abs(this.position.x - blockPos.x) < (CONFIG.blockSize/2 + mobRadius) &&
                                    Math.abs(this.position.z - blockPos.z) < (CONFIG.blockSize/2 + mobRadius)) {
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        if (collision) break;
                    }
                    if (collision) break;
                }
                
                
                if (collision) {
                    this.position.copy(oldPos);
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
                
                this.velocity.multiplyScalar(0.92);
                this.position.y = this.game.getTerrainHeight(this.position.x, this.position.z) + 0.85;

                this.animTime += delta * 5;
                const isMoving = this.velocity.length() > 0.01;

                if (isMoving) {
                    const swing = Math.sin(this.animTime) * 0.3;
                    this.leftLeg.rotation.x = swing;
                    this.rightLeg.rotation.x = -swing;
                    this.leftArm.rotation.x = -swing * 0.5;
                    this.rightArm.rotation.x = swing * 0.5;
                    this.body.position.y = 0.5 + Math.abs(Math.sin(this.animTime * 2)) * 0.03;
                } else {
                    const breathe = Math.sin(this.animTime * 0.5) * 0.02;
                    this.body.scale.y = 1 + breathe;
                }

                this.mesh.position.copy(this.position);
                this.rotation += (this.targetRotation - this.rotation) * 0.1;
                this.mesh.rotation.y = this.rotation;
            }

            attackPlayer() {
                this.game.takeDamage(CONFIG.enemyDamage);
                
                this.rightArm.rotation.x = -Math.PI / 3;
                setTimeout(() => {
                    this.rightArm.rotation.x = 0;
                }, 200);
            }

            takeDamage(amount, hitPosition, isHeadshot = false) {
                const damage = isHeadshot ? amount * 2 : amount;
                this.health -= damage;

                const blood = new FlowingBlood(hitPosition || this.position.clone(), this.game, isHeadshot);
                this.game.bloodParticles.push(blood);

                const originalColor = this.body.material.color.clone();
                this.body.material.color.set(0xff0000);
                setTimeout(() => {
                    if (!this.isDying) {
                        this.body.material.color.copy(originalColor);
                    }
                }, 100);

                if (this.health <= 0) {
                    this.die(isHeadshot);
                }
            }

            die(wasHeadshot) {
                this.isDying = true;
                this.game.killCount++;

                if (wasHeadshot) {
                    this.game.headshotCount++;
                    this.game.showKillNotification('💀 HEADSHOT! 💀');
                    document.getElementById('headshot-count').textContent = this.game.headshotCount;
                }

                document.getElementById('kill-count').textContent = this.game.killCount;

                const deathPool = new BloodPool(this.position.clone(), this.game, 2 + Math.random());

                let fallProgress = 0;
                let rotationMultiplier = wasHeadshot ? 3 : 1;
                const deathAnim = () => {
                    fallProgress += 0.08;
                    this.mesh.rotation.x = fallProgress * Math.PI / 2 * rotationMultiplier;
                    this.mesh.position.y -= 0.08;

                    if (fallProgress < 1) {
                        requestAnimationFrame(deathAnim);
                    } else {
                        this.remove();
                        setTimeout(() => {
                            this.game.spawnSingleEnemy();
                        }, 1000);
                    }
                };
                deathAnim();
            }

            remove() {
                this.game.scene.remove(this.mesh);
                this.mesh.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
                const index = this.game.mobs.indexOf(this);
                if (index > -1) {
                    this.game.mobs.splice(index, 1);
                }
                this.game.updateMobCount();
            }
        }

        class MinecraftPUBG {
            constructor() {
                this.scene = null;
                this.camera = null;
                this.renderer = null;
                this.controls = null;
                this.blocks = new Map();
                this.blockMeshes = [];
                this.mobs = [];
                this.grenades = [];
                this.thrownAxes = [];
                this.bloodParticles = [];
                this.bloodPools = [];
                this.killCount = 0;
                this.headshotCount = 0;
                this.bloodPoolCount = 0;

                this.cameraMode = 'FPP';
                this.tppDistance = 5;
                this.isStealthMode = false;
                this.stealthDetectionRange = 8; // Detection range when in stealth mode

                this.weaponViewModel = null;
                this.handModel = null;

                this.weapons = {
                    pistol: { ...WEAPONS.pistol, currentAmmo: WEAPONS.pistol.magSize, reserveAmmo: 99999 },
                    ar: { ...WEAPONS.ar, currentAmmo: WEAPONS.ar.magSize, reserveAmmo: 99999 },
                    smg: { ...WEAPONS.smg, currentAmmo: WEAPONS.smg.magSize, reserveAmmo: 99999 },
                    shotgun: { ...WEAPONS.shotgun, currentAmmo: WEAPONS.shotgun.magSize, reserveAmmo: 99999 },
                    sniper: { ...WEAPONS.sniper, currentAmmo: WEAPONS.sniper.magSize, reserveAmmo: 99999 },
                    axe: { ...WEAPONS.axe },
                    grenade: { ...WEAPONS.grenade, count: 99999 }
                };

                this.currentWeapon = 'ar';
                this.isADS = false;
                this.isShooting = false; // NEW: Track if mouse is held
                this.isReloading = false;
                this.lastShotTime = 0;

                this.health = 100;
                this.maxHealth = 100;
                this.stamina = 100;
                this.maxStamina = 100;
                this.isSprinting = false;

                this.baseFOV = 75;
                this.currentFOV = 75;
                this.targetFOV = 75;
                this.cameraShakeAmount = 0;
                this.cameraShakeOffset = new THREE.Vector3();

                this.velocity = new THREE.Vector3();
                this.canJump = false;
                this.moveForward = false;
                this.moveBackward = false;
                this.moveLeft = false;
                this.moveRight = false;

                this.raycaster = new THREE.Raycaster();
                this.mouse = new THREE.Vector2(0, 0);

                this.prevTime = performance.now();
                this.spawnTimer = 0;

                this.init();
            }


            init() {
                this.setupScene();
                this.setupCamera();
                this.setupRenderer();
                this.setupLighting();
                this.setupControls();
                this.createWeaponViewModel();
                this.generateTerrain();
                this.generateBuildings();
                this.generateCamps();
                this.spawnEnemies();
                this.setupUI();
                // create minimap after UI elements exist
                try { this.minimap = new Minimap(this); } catch(e) { console.warn('Minimap init failed', e); }
                this.setupEventListeners();
                this.animate();
            }

            setupScene() {
                this.scene = new THREE.Scene();
                this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);
            }

            setupCamera() {
                this.camera = new THREE.PerspectiveCamera(this.baseFOV, window.innerWidth / window.innerHeight, 0.1, 1000);
                this.camera.position.set(0, 10, 10);
            }

            setupRenderer() {
                this.renderer = new THREE.WebGLRenderer({ antialias: true });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.shadowMap.enabled = true;
                this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                document.getElementById('game-container').appendChild(this.renderer.domElement);
            }

            setupLighting() {
                this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
                this.scene.add(this.ambientLight);

                this.sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
                this.sunLight.castShadow = true;
                this.sunLight.shadow.mapSize.width = 2048;
                this.sunLight.shadow.mapSize.height = 2048;
                this.sunLight.position.set(50, 100, 50);
                this.scene.add(this.sunLight);
            }

            setupControls() {
                this.controls = new PointerLockControls(this.camera, document.body);
                this.scene.add(this.controls.getObject());

                this.controls.addEventListener('lock', () => {
                    document.getElementById('menu').style.display = 'none';
                    document.getElementById('hud').classList.add('active');
                    document.getElementById('stats').classList.add('active');
                    document.getElementById('hotbar').classList.add('active');
                    document.getElementById('weapon-info').classList.add('active');
                    document.getElementById('camera-toggle').classList.add('active');
                    if (this.weaponViewModel && this.cameraMode === 'FPP') this.weaponViewModel.visible = true;
                });

                this.controls.addEventListener('unlock', () => {
                    document.getElementById('menu').style.display = 'flex';
                    document.getElementById('hud').classList.remove('active');
                    document.getElementById('stats').classList.remove('active');
                    document.getElementById('hotbar').classList.remove('active');
                    document.getElementById('weapon-info').classList.remove('active');
                    document.getElementById('camera-toggle').classList.remove('active');
                    document.getElementById('sprint-indicator').classList.remove('active');
                    this.exitADS();
                    this.isShooting = false;
                    if (this.weaponViewModel) this.weaponViewModel.visible = false;
                });
            }

            toggleCamera() {
                if (this.cameraMode === 'FPP') {
                    this.cameraMode = 'TPP';
                    document.getElementById('camera-toggle').textContent = 'Camera: TPP (Press V)';
                    if (this.weaponViewModel) this.weaponViewModel.visible = false;
                } else {
                    this.cameraMode = 'FPP';
                    document.getElementById('camera-toggle').textContent = 'Camera: FPP (Press V)';
                    if (this.weaponViewModel && this.controls.isLocked) this.weaponViewModel.visible = true;
                }
            }

            toggleStealthMode() {
                this.isStealthMode = !this.isStealthMode;
                document.getElementById('stealth-toggle').textContent = 
                    this.isStealthMode ? 'Mode: Stealth (Press X)' : 'Mode: Normal (Press X)';
                document.getElementById('stealth-indicator').classList.toggle('active', this.isStealthMode);
                
                // When entering stealth mode, switch to sniper if available
                if (this.isStealthMode && this.weapons.sniper && this.weapons.sniper.currentAmmo > 0) {
                    this.selectWeapon('sniper');
                }
            }

            updateTPPCamera() {
                if (this.cameraMode !== 'TPP') return;

                const playerPos = this.controls.getObject().position;
                const cameraOffset = new THREE.Vector3(0, 2, -6); // Adjusted distance and made it negative to position behind player
                
                // Get camera rotation
                const euler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
                
                // Create a quaternion for vertical rotation
                const verticalRotation = new THREE.Quaternion();
                verticalRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), euler.x * 0.5); // Reduced vertical rotation influence
                
                // Apply horizontal rotation
                cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), euler.y);
                
                // Apply vertical rotation
                cameraOffset.applyQuaternion(verticalRotation);
                
                // Calculate desired camera position
                const targetPos = playerPos.clone().add(cameraOffset);
                
                // Check for wall collisions
                const raycaster = new THREE.Raycaster();
                raycaster.far = 8; // Increased detection range
                raycaster.near = 0.1;
                
                const direction = cameraOffset.clone().normalize();
                const rayOrigin = playerPos.clone();
                rayOrigin.y += 1.5; // Start ray from player's head level
                raycaster.set(rayOrigin, direction);
                
                // Get all blocks that might intersect
                const potentialBlocks = [];
                const checkRadius = 4; // Increased check radius
                const playerGridX = Math.floor((playerPos.x + CONFIG.gridSize/2) / CONFIG.blockSize);
                const playerGridZ = Math.floor((playerPos.z + CONFIG.gridSize/2) / CONFIG.blockSize);
                
                for (let dx = -checkRadius; dx <= checkRadius; dx++) {
                    for (let dy = -checkRadius; dy <= checkRadius; dy++) {
                        for (let dz = -checkRadius; dz <= checkRadius; dz++) {
                            const blockKey = `${playerGridX + dx},${Math.floor(playerPos.y/CONFIG.blockSize) + dy},${playerGridZ + dz}`;
                            const block = this.blocks.get(blockKey);
                            if (block) {
                                potentialBlocks.push(block);
                            }
                        }
                    }
                }
                
                // Check for intersections
                const intersects = raycaster.intersectObjects(potentialBlocks);
                if (intersects.length > 0) {
                    // If there's a wall, position camera just in front of it
                    const hitPoint = intersects[0].point;
                    const distanceToWall = intersects[0].distance;
                    targetPos.copy(rayOrigin).add(direction.multiplyScalar(Math.max(2, distanceToWall - 0.5)));
                }
                
                // Smooth camera movement with faster response
                this.camera.position.lerp(targetPos, 0.2);
                
                // Look at player with offset
                const lookAtPos = playerPos.clone();
                lookAtPos.y += 1.5; // Look at player's head level
                this.camera.lookAt(lookAtPos);
                
                // Keep camera upright
                const up = new THREE.Vector3(0, 1, 0);
                const cameraDirection = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDirection);
                const right = new THREE.Vector3();
                right.crossVectors(up, cameraDirection).normalize();
                const newUp = new THREE.Vector3();
                newUp.crossVectors(cameraDirection, right);
                this.camera.up.copy(newUp);
                
                // Adjust weapon view model visibility
                if (this.weaponViewModel) {
                    this.weaponViewModel.visible = false;
                }
            }

            createWeaponViewModel() {
                this.weaponViewModel = new THREE.Group();

                const handGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.4);
                const handMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDDAA });
                this.handModel = new THREE.Mesh(handGeometry, handMaterial);
                this.handModel.position.set(0.3, -0.3, -0.6);
                this.weaponViewModel.add(this.handModel);

                const gunGeometry = new THREE.BoxGeometry(0.1, 0.15, 0.5);
                const gunMaterial = new THREE.MeshLambertMaterial({ color: 0x2F4F4F });
                this.gunModel = new THREE.Mesh(gunGeometry, gunMaterial);
                this.gunModel.position.set(0.25, -0.2, -0.5);
                this.weaponViewModel.add(this.gunModel);

                this.axeModel = new THREE.Group();
                const handleGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.8, 8);
                const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
                const handle = new THREE.Mesh(handleGeometry, handleMaterial);
                handle.rotation.z = Math.PI / 2;
                this.axeModel.add(handle);
                
                const bladeGeometry = new THREE.BoxGeometry(0.4, 0.35, 0.05);
                const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xCC0000 });
                const blade = new THREE.Mesh(bladeGeometry, bladeMaterial);
                blade.position.set(-0.4, 0, 0);
                this.axeModel.add(blade);
                
                const edgeGeometry = new THREE.BoxGeometry(0.45, 0.1, 0.02);
                const edgeMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
                const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
                edge.position.set(-0.5, 0, 0);
                this.axeModel.add(edge);
                
                this.axeModel.position.set(0.3, -0.2, -0.5);
                this.axeModel.rotation.z = Math.PI / 6;
                this.axeModel.visible = false;
                this.weaponViewModel.add(this.axeModel);

                this.camera.add(this.weaponViewModel);
                this.weaponViewModel.visible = false;

                this.weaponIdleTime = 0;
            }

            updateWeaponViewModel(delta) {
                if (!this.weaponViewModel || !this.weaponViewModel.visible) return;

                this.weaponIdleTime += delta * 2;

                const sway = Math.sin(this.weaponIdleTime) * 0.005;
                this.weaponViewModel.rotation.z = sway;
                this.weaponViewModel.rotation.x = sway * 0.5;

                if (this.currentWeapon === 'axe') {
                    this.gunModel.visible = false;
                    this.axeModel.visible = true;
                } else if (this.currentWeapon === 'grenade') {
                    this.gunModel.visible = false;
                    this.axeModel.visible = false;
                } else {
                    this.gunModel.visible = true;
                    this.axeModel.visible = false;

                    const weapon = this.weapons[this.currentWeapon];
                    if (weapon && weapon.color) {
                        this.gunModel.material.color.set(weapon.color);
                    }
                }
            }

            takeDamage(amount) {
                this.health = Math.max(0, this.health - amount);
                this.updateHealthDisplay();

                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 0, 0, 0.3);
                    pointer-events: none;
                    z-index: 1000;
                `;
                document.body.appendChild(overlay);
                setTimeout(() => overlay.remove(), 200);

                if (this.health === 0) {
                    setTimeout(() => {
                        alert('You died! Refresh to respawn.');
                        this.controls.unlock();
                    }, 500);
                }
            }

            createBlock(color) {
                const geometry = new THREE.BoxGeometry(CONFIG.blockSize, CONFIG.blockSize, CONFIG.blockSize);
                const material = new THREE.MeshLambertMaterial({ color });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                return mesh;
            }

            generateTerrain() {
                const offset = (CONFIG.gridSize * CONFIG.blockSize) / 2;

                for (let x = 0; x < CONFIG.gridSize; x++) {
                    for (let z = 0; z < CONFIG.gridSize; z++) {
                        const height = Math.floor(
                            Math.sin(x * 0.1) * Math.cos(z * 0.1) * 2 +
                            Math.sin(x * 0.05) * 1.5 +
                            3
                        );

                        for (let y = 0; y <= height; y++) {
                            let color = 0x7F7F7F;
                            if (y === height) color = 0x5FAD56;
                            else if (y >= height - 1) color = 0x8B6F47;

                            const block = this.createBlock(color);
                            const posX = x * CONFIG.blockSize - offset;
                            const posY = y * CONFIG.blockSize;
                            const posZ = z * CONFIG.blockSize - offset;

                            block.position.set(posX, posY, posZ);
                            this.scene.add(block);
                            this.blocks.set(`${x},${y},${z}`, block);
                            this.blockMeshes.push(block);
                        }
                    }
                }
            }

            generateBuildings() {
                const buildingCount = 8;
                const offset = (CONFIG.gridSize * CONFIG.blockSize) / 2;

                for (let i = 0; i < buildingCount; i++) {
                    const x = Math.floor(Math.random() * (CONFIG.gridSize - 10)) + 5;
                    const z = Math.floor(Math.random() * (CONFIG.gridSize - 10)) + 5;

                    let groundY = 0;
                    for (let y = 10; y >= 0; y--) {
                        if (this.blocks.has(`${x},${y},${z}`)) {
                            groundY = y + 1;
                            break;
                        }
                    }

                    const width = 5 + Math.floor(Math.random() * 3);
                    const depth = 5 + Math.floor(Math.random() * 3);
                    const height = 4 + Math.floor(Math.random() * 3);

                    for (let bx = 0; bx < width; bx++) {
                        for (let bz = 0; bz < depth; bz++) {
                            for (let by = 0; by < height; by++) {
                                if (bx === 0 || bx === width - 1 || bz === 0 || bz === depth - 1 || by === height - 1) {
                                    if (by < 2 && bz === 0 && bx === Math.floor(width / 2)) continue;

                                    const block = this.createBlock(0x8B4513);
                                    const lx = x + bx;
                                    const ly = groundY + by;
                                    const lz = z + bz;

                                    block.position.set(
                                        lx * CONFIG.blockSize - offset,
                                        ly * CONFIG.blockSize,
                                        lz * CONFIG.blockSize - offset
                                    );

                                    this.scene.add(block);
                                    this.blockMeshes.push(block);
                                }
                            }
                        }
                    }
                }
            }

            generateCamps() {
                const campCount = 5;
                const offset = (CONFIG.gridSize * CONFIG.blockSize) / 2;

                for (let i = 0; i < campCount; i++) {
                    const x = Math.floor(Math.random() * (CONFIG.gridSize - 8)) + 4;
                    const z = Math.floor(Math.random() * (CONFIG.gridSize - 8)) + 4;

                    let groundY = 0;
                    for (let y = 10; y >= 0; y--) {
                        if (this.blocks.has(`${x},${y},${z}`)) {
                            groundY = y + 1;
                            break;
                        }
                    }

                    const positions = [
                        [0, 0], [1, 0], [2, 0],
                        [0, 2], [1, 2], [2, 2],
                        [0, 1], [2, 1]
                    ];

                    positions.forEach(([dx, dz]) => {
                        const block = this.createBlock(0x654321);
                        block.position.set(
                            (x + dx) * CONFIG.blockSize - offset,
                            groundY * CONFIG.blockSize + CONFIG.blockSize,
                            (z + dz) * CONFIG.blockSize - offset
                        );
                        this.scene.add(block);
                        this.blockMeshes.push(block);
                    });
                }
            }

            getTerrainHeight(x, z) {
                const offset = (CONFIG.gridSize * CONFIG.blockSize) / 2;
                const gridX = Math.floor((x + offset) / CONFIG.blockSize);
                const gridZ = Math.floor((z + offset) / CONFIG.blockSize);

                for (let y = 25; y >= 0; y--) {
                    if (this.blocks.has(`${gridX},${y},${gridZ}`)) {
                        return y * CONFIG.blockSize + CONFIG.blockSize;
                    }
                }
                return 0;
            }

            spawnEnemies() {
                for (let i = 0; i < 20; i++) {
                    this.spawnSingleEnemy();
                }
                this.updateMobCount();
            }

            spawnSingleEnemy() {
                const playerPos = this.controls.getObject().position;
                let x, z, distFromPlayer;

                do {
                    x = (Math.random() - 0.5) * CONFIG.gridSize * 0.8;
                    z = (Math.random() - 0.5) * CONFIG.gridSize * 0.8;
                    distFromPlayer = Math.sqrt(
                        Math.pow(x - playerPos.x, 2) +
                        Math.pow(z - playerPos.z, 2)
                    );
                } while (distFromPlayer < CONFIG.mobSpawnDistance);

                const y = this.getTerrainHeight(x, z) + 1;

                const mob = new Mob('enemy', new THREE.Vector3(x, y, z), this);
                this.mobs.push(mob);
                this.scene.add(mob.mesh);
                this.updateMobCount();
            }

            updateMobCount() {
                document.getElementById('mob-count').textContent = this.mobs.length;
            }

            showKillNotification(text) {
                const notification = document.createElement('div');
                notification.className = 'kill-notification';
                notification.textContent = text;
                document.body.appendChild(notification);

                setTimeout(() => {
                    notification.remove();
                }, 800);
            }

            enterADS() {
                if (!this.weapons[this.currentWeapon].hasScope || this.isADS) return;

                this.isADS = true;
                const weapon = this.weapons[this.currentWeapon];
                this.targetFOV = this.baseFOV / weapon.scopeZoom;
                document.getElementById('scope-overlay').classList.add('active');
                document.getElementById('crosshair').style.display = 'none';
            }

            exitADS() {
                if (!this.isADS) return;

                this.isADS = false;
                this.targetFOV = this.baseFOV;
                document.getElementById('scope-overlay').classList.remove('active');
                document.getElementById('crosshair').style.display = 'block';
            }

            throwAxe() {
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);

                const position = this.camera.position.clone();
                position.add(direction.multiplyScalar(1));

                this.camera.getWorldDirection(direction);
                const axe = new ThrownAxe(position, direction, this);
                this.thrownAxes.push(axe);

                this.cameraShakeAmount = 0.2;
            }

            // NEW: Fully automatic firing
            shootAutomatic(currentTime) {
                if (this.isReloading) return;

                const weapon = this.weapons[this.currentWeapon];
                
                if (weapon.currentAmmo <= 0) {
                    this.reload();
                    return;
                }

                // Check fire rate
                if (currentTime - this.lastShotTime < weapon.fireRate) {
                    return;
                }

                this.lastShotTime = currentTime;
                weapon.currentAmmo--;
                this.updateWeaponInfo();

                if (this.gunModel && this.gunModel.visible) {
                    this.gunModel.position.z += 0.05;
                    setTimeout(() => {
                        this.gunModel.position.z -= 0.05;
                    }, 50);
                }

                this.raycaster.setFromCamera(this.mouse, this.camera);
                this.raycaster.far = weapon.range;

                const mobMeshes = this.mobs.map(mob => mob.mesh);

                if (weapon.pellets) {
                    for (let i = 0; i < weapon.pellets; i++) {
                        const spread = weapon.spread;
                        const spreadRay = new THREE.Raycaster();
                        spreadRay.far = weapon.range;

                        const spreadMouse = new THREE.Vector2(
                            this.mouse.x + (Math.random() - 0.5) * spread,
                            this.mouse.y + (Math.random() - 0.5) * spread
                        );

                        spreadRay.setFromCamera(spreadMouse, this.camera);
                        const intersects = spreadRay.intersectObjects(mobMeshes, true);

                        if (intersects.length > 0) {
                            const hitMesh = intersects[0].object;
                            const hitPoint = intersects[0].point;
                            const isHeadshot = hitMesh.userData.isHead;
                            const mob = this.mobs.find(m => m.mesh === hitMesh.parent || m.mesh.children.includes(hitMesh));
                            if (mob) {
                                mob.takeDamage(weapon.damage / weapon.pellets, hitPoint, isHeadshot);
                            }
                        }
                    }
                } else {
                    const intersects = this.raycaster.intersectObjects(mobMeshes, true);

                    if (intersects.length > 0) {
                        const hitMesh = intersects[0].object;
                        const hitPoint = intersects[0].point;
                        const isHeadshot = hitMesh.userData.isHead;
                        const mob = this.mobs.find(m => m.mesh === hitMesh.parent || m.mesh.children.includes(hitMesh));
                        if (mob) {
                            const finalDamage = weapon.oneShot ? 999 : (isHeadshot ? weapon.damage * weapon.headshotMultiplier : weapon.damage);
                            mob.takeDamage(finalDamage, hitPoint, isHeadshot);
                        }
                    }
                }

                this.cameraShakeAmount = 0.08;

                const flash = document.createElement('div');
                flash.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255, 255, 0, 0.08);
                    pointer-events: none;
                    z-index: 999;
                `;
                document.body.appendChild(flash);
                setTimeout(() => flash.remove(), 30);
            }

            reload() {
                const weapon = this.weapons[this.currentWeapon];

                if (this.isReloading || weapon.currentAmmo === weapon.magSize || weapon.reserveAmmo === 0) return;

                this.isReloading = true;
                const ammoNeeded = weapon.magSize - weapon.currentAmmo;
                const ammoToReload = Math.min(ammoNeeded, weapon.reserveAmmo);

                setTimeout(() => {
                    weapon.currentAmmo += ammoToReload;
                    weapon.reserveAmmo -= ammoToReload;
                    this.isReloading = false;
                    this.updateWeaponInfo();
                }, weapon.reloadTime);
            }

            throwGrenade() {
                const weapon = this.weapons.grenade;
                if (weapon.count <= 0) return;

                weapon.count--;
                this.updateWeaponInfo();

                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);

                const position = this.camera.position.clone();
                position.add(direction.multiplyScalar(1));

                this.camera.getWorldDirection(direction);
                const grenade = new Grenade(position, direction, this);
                this.grenades.push(grenade);
            }

            setupUI() {
                this.updateHealthDisplay();
                this.updateStaminaDisplay();
                this.updateWeaponInfo();
                document.getElementById('kill-count').textContent = this.killCount;
                document.getElementById('headshot-count').textContent = this.headshotCount;
                document.getElementById('blood-pool-count').textContent = this.bloodPoolCount;

                const hotbar = document.getElementById('hotbar');
                const weaponKeys = ['pistol', 'ar', 'smg', 'shotgun', 'sniper', 'axe', 'grenade'];

                weaponKeys.forEach((weapon, index) => {
                    const slot = document.createElement('div');
                    slot.className = 'hotbar-slot';
                    if (weapon === this.currentWeapon) slot.classList.add('active');

                    const number = document.createElement('div');
                    number.className = 'slot-number';
                    number.textContent = index + 1;

                    const icon = document.createElement('i');
                    icon.className = `fas ${WEAPONS[weapon].icon}`;
                    icon.style.color = WEAPONS[weapon].color;

                    const label = document.createElement('div');
                    label.className = 'slot-label';
                    label.textContent = WEAPONS[weapon].name;

                    slot.appendChild(number);
                    slot.appendChild(icon);
                    slot.appendChild(label);
                    hotbar.appendChild(slot);

                    slot.addEventListener('click', () => this.selectWeapon(weapon));
                });
            }

            updateHealthDisplay() {
                const container = document.getElementById('health-container');
                container.innerHTML = '';
                const hearts = Math.ceil(this.maxHealth / 10);
                for (let i = 0; i < hearts; i++) {
                    const heart = document.createElement('i');
                    heart.className = i < Math.ceil(this.health / 10) ? 'fas fa-heart' : 'far fa-heart';
                    heart.style.color = i < Math.ceil(this.health / 10) ? '#ff0000' : '#333';
                    container.appendChild(heart);
                }
            }

            updateStaminaDisplay() {
                const container = document.getElementById('stamina-container');
                container.innerHTML = '';
                const bars = 10;
                for (let i = 0; i < bars; i++) {
                    const bar = document.createElement('i');
                    bar.className = 'fas fa-square';
                    bar.style.color = i < Math.ceil(this.stamina / 10) ? '#00ff00' : '#333';
                    bar.style.fontSize = '16px';
                    container.appendChild(bar);
                }
            }

            updateWeaponInfo() {
                const weapon = this.weapons[this.currentWeapon];
                document.getElementById('weapon-name').textContent = weapon.name;

                if (weapon.isMelee) {
                    document.getElementById('fire-mode').textContent = 'THROWABLE MELEE';
                    document.getElementById('ammo-current').textContent = '∞';
                    document.getElementById('ammo-reserve').textContent = '';
                } else if (weapon.isFullAuto) {
                    document.getElementById('fire-mode').textContent = 'FULL AUTO';
                    document.getElementById('ammo-current').textContent = weapon.currentAmmo;
                    document.getElementById('ammo-reserve').textContent = weapon.reserveAmmo;
                } else if (weapon.oneShot) {
                    document.getElementById('fire-mode').textContent = 'ONE SHOT KILL';
                    document.getElementById('ammo-current').textContent = weapon.currentAmmo;
                    document.getElementById('ammo-reserve').textContent = weapon.reserveAmmo;
                } else if (weapon.count !== undefined) {
                    document.getElementById('fire-mode').textContent = 'EXPLOSIVE';
                    document.getElementById('ammo-current').textContent = weapon.count;
                    document.getElementById('ammo-reserve').textContent = '';
                }
            }

            selectWeapon(weapon) {
                this.exitADS();
                this.currentWeapon = weapon;

                document.querySelectorAll('.hotbar-slot').forEach((slot, index) => {
                    const weaponKeys = ['pistol', 'ar', 'smg', 'shotgun', 'sniper', 'axe', 'grenade'];
                    slot.classList.toggle('active', weaponKeys[index] === weapon);
                });

                this.updateWeaponInfo();
            }

            setupEventListeners() {
                document.getElementById('start-btn').addEventListener('click', () => {
                    this.controls.lock();
                });

                document.getElementById('camera-toggle').addEventListener('click', () => {
                    this.toggleCamera();
                });

                document.addEventListener('keydown', (e) => {
                    switch (e.code) {
                        case 'KeyW': this.moveForward = true; break;
                        case 'KeyS': this.moveBackward = true; break;
                        case 'KeyA': this.moveLeft = true; break;
                        case 'KeyD': this.moveRight = true; break;
                        case 'ShiftLeft':
                        case 'ShiftRight':
                            if (this.stamina > 0) {
                                this.isSprinting = true;
                                if (!this.isADS) this.targetFOV = this.baseFOV + 10;
                                document.getElementById('sprint-indicator').classList.add('active');
                            }
                            break;
                        case 'Space':
                            if (this.canJump && this.stamina > 0) {
                                this.velocity.y = CONFIG.jumpForce;
                                this.canJump = false;
                                this.stamina = Math.max(0, this.stamina - 10);
                                this.updateStaminaDisplay();
                            }
                            break;
                        case 'KeyR': this.reload(); break;
                        case 'KeyG': this.throwGrenade(); break;
                        case 'KeyQ':
                            if (this.currentWeapon === 'axe') {
                                this.throwAxe();
                            } else {
                                this.selectWeapon('axe');
                            }
                            break;
                        case 'KeyV': this.toggleCamera(); break;
                        case 'KeyX': this.toggleStealthMode(); break;
                        case 'Digit1': this.selectWeapon('pistol'); break;
                        case 'Digit2': this.selectWeapon('ar'); break;
                        case 'Digit3': this.selectWeapon('smg'); break;
                        case 'Digit4': this.selectWeapon('shotgun'); break;
                        case 'Digit5': this.selectWeapon('sniper'); break;
                        case 'Digit6': this.selectWeapon('axe'); break;
                        case 'Digit7': this.selectWeapon('grenade'); break;
                    }
                });

                document.addEventListener('keyup', (e) => {
                    switch (e.code) {
                        case 'KeyW': this.moveForward = false; break;
                        case 'KeyS': this.moveBackward = false; break;
                        case 'KeyA': this.moveLeft = false; break;
                        case 'KeyD': this.moveRight = false; break;
                        case 'ShiftLeft':
                        case 'ShiftRight':
                            this.isSprinting = false;
                            if (!this.isADS) this.targetFOV = this.baseFOV;
                            document.getElementById('sprint-indicator').classList.remove('active');
                            break;
                    }
                });

                document.addEventListener('wheel', (e) => {
                    if (!this.controls.isLocked) return;

                    e.preventDefault();
                    const weaponKeys = ['pistol', 'ar', 'smg', 'shotgun', 'sniper', 'axe', 'grenade'];
                    const currentIndex = weaponKeys.indexOf(this.currentWeapon);

                    if (e.deltaY > 0) {
                        const nextIndex = (currentIndex + 1) % weaponKeys.length;
                        this.selectWeapon(weaponKeys[nextIndex]);
                    } else {
                        const prevIndex = (currentIndex - 1 + weaponKeys.length) % weaponKeys.length;
                        this.selectWeapon(weaponKeys[prevIndex]);
                    }
                }, { passive: false });

                document.addEventListener('mousedown', (e) => {
                    if (!this.controls.isLocked) return;

                    if (e.button === 0) {
                        this.isShooting = true; // Start shooting
                        
                        if (this.currentWeapon === 'grenade') {
                            this.throwGrenade();
                        } else if (this.currentWeapon === 'axe') {
                            this.throwAxe();
                        }
                    } else if (e.button === 2) {
                        if (this.weapons[this.currentWeapon].hasScope) {
                            this.enterADS();
                        }
                    }
                });

                document.addEventListener('mouseup', (e) => {
                    if (e.button === 0) {
                        this.isShooting = false; // Stop shooting
                    } else if (e.button === 2) {
                        this.exitADS();
                    }
                });

                document.addEventListener('contextmenu', (e) => {
                    if (this.controls.isLocked) e.preventDefault();
                });

                window.addEventListener('resize', () => {
                    this.camera.aspect = window.innerWidth / window.innerHeight;
                    this.camera.updateProjectionMatrix();
                    this.renderer.setSize(window.innerWidth, window.innerHeight);
                });
            }

            updateMovement(delta) {
                if (this.health < this.maxHealth) {
                    this.health = Math.min(this.maxHealth, this.health + CONFIG.healthRegenRate * delta);
                    this.updateHealthDisplay();
                }

                if (!this.isSprinting && this.stamina < this.maxStamina) {
                    this.stamina = Math.min(this.maxStamina, this.stamina + delta * 20);
                    this.updateStaminaDisplay();
                }

                if (this.isSprinting && (this.moveForward || this.moveBackward)) {
                    this.stamina = Math.max(0, this.stamina - delta * 15);
                    this.updateStaminaDisplay();
                    if (this.stamina === 0) {
                        this.isSprinting = false;
                        if (!this.isADS) this.targetFOV = this.baseFOV;
                        document.getElementById('sprint-indicator').classList.remove('active');
                    }
                }

                this.currentFOV += (this.targetFOV - this.currentFOV) * 0.1;
                this.camera.fov = this.currentFOV;
                this.camera.updateProjectionMatrix();

                if (this.cameraShakeAmount > 0) {
                    this.cameraShakeOffset.x = (Math.random() - 0.5) * this.cameraShakeAmount;
                    this.cameraShakeOffset.y = (Math.random() - 0.5) * this.cameraShakeAmount;
                    this.cameraShakeOffset.z = (Math.random() - 0.5) * this.cameraShakeAmount;

                    this.camera.position.add(this.cameraShakeOffset);

                    this.cameraShakeAmount *= 0.85;
                    if (this.cameraShakeAmount < 0.001) {
                        this.cameraShakeAmount = 0;
                        this.cameraShakeOffset.set(0, 0, 0);
                    } else {
                        this.camera.position.sub(this.cameraShakeOffset);
                    }
                }

                this.velocity.y -= CONFIG.gravity * delta;
                this.velocity.x -= this.velocity.x * 10 * delta;
                this.velocity.z -= this.velocity.z * 10 * delta;

                const direction = new THREE.Vector3();
                direction.z = Number(this.moveForward) - Number(this.moveBackward);
                direction.x = Number(this.moveRight) - Number(this.moveLeft);
                direction.normalize();

                const speed = this.isSprinting ? CONFIG.sprintSpeed : CONFIG.moveSpeed;

                if (this.moveForward || this.moveBackward) {
                    this.velocity.z -= direction.z * speed * delta;
                }
                if (this.moveLeft || this.moveRight) {
                    this.velocity.x -= direction.x * speed * delta;
                }

                // Store old position for collision check
                const oldPos = this.controls.getObject().position.clone();
                
                this.controls.moveRight(-this.velocity.x * delta);
                this.controls.moveForward(-this.velocity.z * delta);
                this.controls.getObject().position.y += this.velocity.y * delta;

                const pos = this.controls.getObject().position;
                const playerRadius = 0.4;  // approximate player width/2
                const gridX = Math.floor((pos.x + CONFIG.gridSize/2) / CONFIG.blockSize);
                const gridZ = Math.floor((pos.z + CONFIG.gridSize/2) / CONFIG.blockSize);
                
                // Check surrounding blocks for collisions
                let collision = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dz = -1; dz <= 1; dz++) {
                        const checkX = gridX + dx;
                        const checkZ = gridZ + dz;
                        
                        // Check blocks from floor to head height
                        for (let y = Math.floor(pos.y / CONFIG.blockSize); y <= Math.ceil((pos.y + CONFIG.playerHeight) / CONFIG.blockSize); y++) {
                            const blockKey = `${checkX},${y},${checkZ}`;
                            const block = this.blocks.get(blockKey);
                            
                            if (block) {
                                const blockPos = new THREE.Vector3(
                                    checkX * CONFIG.blockSize - CONFIG.gridSize/2,
                                    y * CONFIG.blockSize,
                                    checkZ * CONFIG.blockSize - CONFIG.gridSize/2
                                );
                                
                                // Simple box collision check
                                if (Math.abs(pos.x - blockPos.x) < (CONFIG.blockSize/2 + playerRadius) &&
                                    Math.abs(pos.z - blockPos.z) < (CONFIG.blockSize/2 + playerRadius)) {
                                    collision = true;
                                    break;
                                }
                            }
                        }
                        if (collision) break;
                    }
                    if (collision) break;
                }
                
                // If collision detected, revert to old position
                if (collision) {
                    this.controls.getObject().position.copy(oldPos);
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }

                const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
                const minHeight = terrainHeight + CONFIG.playerHeight;

                if (pos.y < minHeight) {
                    this.velocity.y = 0;
                    this.controls.getObject().position.y = minHeight;
                    this.canJump = true;
                }
            }

            animate() {
                requestAnimationFrame(() => this.animate());

                const time = performance.now();
                const delta = Math.min((time - this.prevTime) / 1000, 0.1);

                if (this.controls.isLocked) {
                    this.updateMovement(delta);
                    this.updateWeaponViewModel(delta);

                    if (this.cameraMode === 'TPP') {
                        this.updateTPPCamera();
                    }

                    // NEW: Continuous automatic firing
                    if (this.isShooting && this.currentWeapon !== 'axe' && this.currentWeapon !== 'grenade') {
                        this.shootAutomatic(time);
                    }

                    this.mobs.forEach(mob => mob.update(delta));

                    for (let i = this.grenades.length - 1; i >= 0; i--) {
                        if (this.grenades[i].update(delta)) {
                            this.grenades.splice(i, 1);
                        }
                    }

                    for (let i = this.thrownAxes.length - 1; i >= 0; i--) {
                        if (this.thrownAxes[i].update(delta)) {
                            this.thrownAxes.splice(i, 1);
                        }
                    }

                    for (let i = this.bloodParticles.length - 1; i >= 0; i--) {
                        if (this.bloodParticles[i].update(delta)) {
                            this.bloodParticles.splice(i, 1);
                        }
                    }

                    this.spawnTimer += delta;
                    if (this.spawnTimer >= CONFIG.mobSpawnInterval && this.mobs.length < 30) {
                        this.spawnSingleEnemy();
                        this.spawnTimer = 0;
                    }

                    // update minimap
                    if (this.minimap) this.minimap.update(delta);
                }

                this.prevTime = time;
                this.renderer.render(this.scene, this.camera);
            }
        }

                // Simple minimap implementation
                class Minimap {
                    constructor(game) {
                        this.game = game;
                        this.canvas = document.getElementById('minimap-canvas');
                        this.ctx = this.canvas.getContext('2d');
                        this.width = this.canvas.width;
                        this.height = this.canvas.height;
                        this.scale = 4; // world units to pixels
                        this.showTerrain = true;
                        this.showMobs = true;
                        this.showPlayer = true;

                        document.getElementById('mm-toggle-terrain').addEventListener('click', () => { this.showTerrain = !this.showTerrain; this.updateTitle(); });
                        document.getElementById('mm-toggle-mobs').addEventListener('click', () => { this.showMobs = !this.showMobs; this.updateTitle(); });
                        document.getElementById('mm-toggle-player').addEventListener('click', () => { this.showPlayer = !this.showPlayer; this.updateTitle(); });
                    }

                    updateTitle() {
                        const layers = [];
                        if (this.showTerrain) layers.push('Terrain');
                        if (this.showMobs) layers.push('Mobs');
                        if (this.showPlayer) layers.push('Player');
                        document.querySelector('#minimap .title').textContent = `Brutalian - Layers: ${layers.join(', ') || 'None'}`;
                    }

                    worldToMap(pos, center) {
                        const dx = pos.x - center.x;
                        const dz = pos.z - center.z;
                        const mx = this.width / 2 + dx * this.scale;
                        const my = this.height / 2 + dz * this.scale;
                        return { x: mx, y: my };
                    }

                    update(delta) {
                        const ctx = this.ctx;
                        ctx.clearRect(0, 0, this.width, this.height);

                        const playerPos = this.game.controls.getObject().position;

                        // Draw terrain grid (approximate)
                        if (this.showTerrain) {
                            ctx.fillStyle = 'rgba(100,100,100,0.2)';
                            const size = 50;
                            for (let x = -size; x <= size; x += 1) {
                                for (let z = -size; z <= size; z += 1) {
                                    const worldX = x;
                                    const worldZ = z;
                                    const height = Math.floor(this.game.getTerrainHeight(worldX, worldZ));
                                    const shade = Math.min(1, Math.max(0, height / 10));
                                    ctx.fillStyle = `rgba(${50 + shade*100},${80 + shade*80},${50 + shade*30},0.08)`;
                                    const p = this.worldToMap({x: worldX, z: worldZ}, playerPos);
                                    ctx.fillRect(p.x, p.y, this.scale, this.scale);
                                }
                            }
                        }

                        // Draw mobs
                        if (this.showMobs) {
                            this.game.mobs.forEach(mob => {
                                const p = this.worldToMap(mob.position, playerPos);
                                ctx.fillStyle = 'rgba(255,0,0,0.9)';
                                ctx.beginPath();
                                ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
                                ctx.fill();
                            });
                        }

                        // Draw player at center
                        if (this.showPlayer) {
                            ctx.fillStyle = '#00FF00';
                            ctx.beginPath();
                            ctx.arc(this.width/2, this.height/2, 4, 0, Math.PI*2);
                            ctx.fill();
                        }
                    }
                }

        window.addEventListener('DOMContentLoaded', () => {
            new MinecraftPUBG();
        });
